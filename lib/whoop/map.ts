import type { WhoopDay } from "@/lib/whoop/parse";
import { applyNewestPartial, blendScore, cycleDay } from "@/lib/whoop/parse";

/**
 * Day labels follow main: shift the cycle's UTC `start` by `timezone_offset`
 * (the CSV export is in that local clock), then `cycleDay`, which rolls a
 * start at or after 18:00 onto the next date.
 *
 * Open PR #58 labels by Wake onset instead, and partial-scores every incomplete
 * day rather than only the newest. This mapping follows main on purpose.
 */

export type WhoopCycleRecord = {
  id: number;
  start?: string | null;
  end?: string | null;
  timezone_offset?: string | null;
  score_state?: string | null;
  score?: { strain?: number | null } | null;
};

export type WhoopRecoveryRecord = {
  cycle_id: number;
  score_state?: string | null;
  score?: {
    recovery_score?: number | null;
    resting_heart_rate?: number | null;
    hrv_rmssd_milli?: number | null;
  } | null;
};

export type WhoopSleepRecord = {
  id?: string;
  cycle_id: number;
  nap?: boolean | null;
  start?: string | null;
  end?: string | null;
  score_state?: string | null;
  score?: { sleep_performance_percentage?: number | null } | null;
};

export type WhoopWindow = {
  cycles: WhoopCycleRecord[];
  recoveries: WhoopRecoveryRecord[];
  sleeps: WhoopSleepRecord[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** `+07:00` / `-05:00` / `Z` → minutes. Null when the offset is missing or junk. */
export function timezoneOffsetMinutes(offset: string | null | undefined): number | null {
  if (!offset) return null;
  const trimmed = offset.trim();
  if (trimmed === "Z") return 0;
  const match = trimmed.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** Local `YYYY-MM-DD HH:mm` for a WHOOP UTC timestamp, or the original string if it cannot be shifted. */
export function localCycleStart(start: string, timezoneOffset: string | null | undefined): string {
  const ms = Date.parse(start);
  const offsetMin = timezoneOffsetMinutes(timezoneOffset);
  if (!Number.isFinite(ms) || offsetMin == null) return start;
  const local = new Date(ms + offsetMin * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

function metric(state: string | null | undefined, value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (state != null && state !== "SCORED") return null;
  return value;
}

/** Main (non-nap) sleep for a cycle. A nap must not replace that night's sleep performance. */
function pickSleep(sleeps: WhoopSleepRecord[]): WhoopSleepRecord | undefined {
  const mains = sleeps.filter((sleep) => sleep.nap !== true);
  const scored = mains.filter(
    (sleep) => sleep.score_state === "SCORED" || (sleep.score_state == null && sleep.score?.sleep_performance_percentage != null)
  );
  const pool = scored.length > 0 ? scored : mains;
  return [...pool].sort((a, b) => (b.end ?? "").localeCompare(a.end ?? ""))[0];
}

function dayFromCycle(
  cycle: WhoopCycleRecord,
  recovery: WhoopRecoveryRecord | undefined,
  sleep: WhoopSleepRecord | undefined
): WhoopDay | null {
  if (!cycle.start) return null;
  const day = cycleDay(localCycleStart(cycle.start, cycle.timezone_offset));
  if (!day) return null;

  const recoveryScore = metric(recovery?.score_state, recovery?.score?.recovery_score);
  const sleepScore = metric(sleep?.score_state, sleep?.score?.sleep_performance_percentage);
  const strain = metric(cycle.score_state, cycle.score?.strain);
  const resting = metric(recovery?.score_state, recovery?.score?.resting_heart_rate);
  const hrv = metric(recovery?.score_state, recovery?.score?.hrv_rmssd_milli);

  return {
    day,
    recovery: recoveryScore == null ? null : round1(recoveryScore),
    sleep: sleepScore == null ? null : round1(sleepScore),
    strain: strain == null ? null : round1(strain),
    resting_hr: resting == null ? null : Math.round(resting),
    hrv: hrv == null ? null : round1(hrv),
    score: blendScore(
      recoveryScore == null ? null : round1(recoveryScore),
      sleepScore == null ? null : round1(sleepScore),
      strain == null ? null : round1(strain)
    ),
  };
}

/**
 * Join v2 cycles, recoveries and sleeps into whoop_days-shaped rows.
 * `partialNewest` applies main's in-progress rule to the newest day in this set.
 * Pass false when the set might not include the member's actual newest day;
 * the sync layer decides that against the rows already stored.
 */
export function daysFromWhoop(window: WhoopWindow, options?: { partialNewest?: boolean }): WhoopDay[] {
  const recoveries = new Map<number, WhoopRecoveryRecord>();
  for (const recovery of window.recoveries) recoveries.set(recovery.cycle_id, recovery);

  const sleeps = new Map<number, WhoopSleepRecord[]>();
  for (const sleep of window.sleeps) {
    const list = sleeps.get(sleep.cycle_id);
    if (list) list.push(sleep);
    else sleeps.set(sleep.cycle_id, [sleep]);
  }

  const byDay = new Map<string, WhoopDay>();
  for (const cycle of window.cycles) {
    const row = dayFromCycle(cycle, recoveries.get(cycle.id), pickSleep(sleeps.get(cycle.id) ?? []));
    if (!row) continue;
    const prev = byDay.get(row.day);
    // Two cycles can land on one wake day (a nap-split). Keep the scored one.
    if (!prev || (prev.score == null && row.score != null)) byDay.set(row.day, row);
  }

  const days = Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
  return options?.partialNewest ? applyNewestPartial(days) : days;
}

export type WhoopDayInsert = {
  user_id: string;
  day: string;
  recovery: number | null;
  sleep: number | null;
  strain: number | null;
  resting_hr: number | null;
  hrv: number | null;
  score: number | null;
  missed: false;
  upload_id: null;
};

function hasSignal(day: WhoopDay): boolean {
  return (
    day.score != null ||
    day.recovery != null ||
    day.sleep != null ||
    day.strain != null ||
    day.resting_hr != null ||
    day.hrv != null
  );
}

/** Rows for `whoop_days`. API-sourced: missed is false and upload_id is null. */
export function toWhoopDayRows(userId: string, days: WhoopDay[]): WhoopDayInsert[] {
  return days.filter(hasSignal).map((day) => ({
    user_id: userId,
    day: day.day,
    recovery: day.recovery,
    sleep: day.sleep,
    strain: day.strain,
    resting_hr: day.resting_hr,
    hrv: day.hrv,
    score: day.score,
    missed: false,
    upload_id: null,
  }));
}
