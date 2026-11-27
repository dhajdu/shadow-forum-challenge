// Pure helpers that turn a rider's whoop_days / whoop_journal rows into the My Zone views.
import { STRAIN_MAX } from "@/lib/whoop/parse";

export type WhoopDay = {
  day: string;
  score: number | null;
  recovery: number | null;
  sleep: number | null;
  strain: number | null;
  resting_hr: number | null;
  hrv: number | null;
  missed: boolean;
};

export type JournalRow = { day: string; question: string; answered_yes: boolean | null };

type MetricKey = "score" | "recovery" | "sleep" | "strain" | "hrv" | "resting_hr";
const METRICS: { key: MetricKey; label: string; unit?: string; lowerBetter?: boolean }[] = [
  { key: "score", label: "Race score" },
  { key: "recovery", label: "Recovery", unit: "%" },
  { key: "sleep", label: "Sleep", unit: "%" },
  { key: "strain", label: "Strain" },
  { key: "hrv", label: "HRV", unit: "ms" },
  { key: "resting_hr", label: "Resting HR", unit: "bpm", lowerBetter: true },
];

export const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** YYYY-MM-DD shifted by n calendar days. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "Sep 27" */
export const shortDate = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Values of one metric for the n calendar days ending at `end` (oldest → newest, null = no value). */
function lastN(byDay: Map<string, WhoopDay>, key: MetricKey, end: string, n: number): (number | null)[] {
  return Array.from({ length: n }, (_, i) => byDay.get(addDays(end, i - n + 1))?.[key] ?? null);
}
const present = (xs: (number | null)[]) => xs.filter((v): v is number => v != null);

/** Most recent scored day, its components, and how it compares with the 30 days before it. */
export function latestDay(days: WhoopDay[]) {
  const scored = days.filter((d) => d.score != null);
  const last = scored[scored.length - 1];
  if (!last) return null;
  const prior = mean(
    scored.filter((d) => d.day < last.day && d.day >= addDays(last.day, -30)).map((d) => d.score as number)
  );
  const parts = [
    { label: "Recovery", pct: last.recovery ?? 0, text: last.recovery != null ? `${last.recovery}%` : "—" },
    { label: "Sleep", pct: last.sleep ?? 0, text: last.sleep != null ? `${last.sleep}%` : "—" },
    {
      label: "Strain",
      pct: Math.min(100, ((last.strain ?? 0) / STRAIN_MAX) * 100),
      text: last.strain != null ? `${round1(last.strain)}/${STRAIN_MAX}` : "—",
    },
  ];
  const sorted = [...parts].sort((a, b) => b.pct - a.pct);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  return {
    day: last.day,
    score: last.score as number,
    delta: prior != null ? round1((last.score as number) - prior) : null,
    parts,
    note: `${best.label} carried the day (${best.text}); ${worst.label.toLowerCase()} held it back (${worst.text}).`,
  };
}

export type StripCell = { day: string; state: "scored" | "missed" | "pending"; score: number | null };

/** One cell per contest day up to `today`: scored, missed (inside the uploaded range) or not uploaded yet. */
export function contestStrip(days: WhoopDay[], start: string, today: string): StripCell[] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const lastData = days.length ? days[days.length - 1].day : null;
  const cells: StripCell[] = [];
  for (let day = start; day <= today; day = addDays(day, 1)) {
    const score = byDay.get(day)?.score ?? null;
    const state = score != null ? "scored" : lastData && day <= lastData ? "missed" : "pending";
    cells.push({ day, state, score });
  }
  return cells;
}

/** Consecutive scored days counting back from the newest uploaded contest day. */
export function currentStreak(cells: StripCell[]): number {
  const uploaded = cells.filter((c) => c.state !== "pending");
  let n = 0;
  for (let i = uploaded.length - 1; i >= 0 && uploaded[i].state === "scored"; i--) n++;
  return n;
}

export type TrendRow = {
  key: MetricKey;
  label: string;
  unit: string;
  bars: (number | null)[]; // last 30 days, oldest → newest
  avg7: number | null;
  avg30: number | null;
  delta: number | null; // 7-day avg minus 30-day avg
  good: boolean | null; // is the delta in the healthy direction?
  all: number[]; // every value, for the expanded chart
};

/**
 * Per-metric trend rows, anchored on the newest uploaded day (uploads lag behind today).
 * "recent": last 30 days as daily bars, 7-day vs 30-day average.
 * "all": up to 26 weekly-average bars, 7-day vs all-time average.
 */
export function trends(days: WhoopDay[], mode: "recent" | "all" = "recent"): TrendRow[] {
  const end = days.length ? days[days.length - 1].day : null;
  const byDay = new Map(days.map((d) => [d.day, d]));
  return METRICS.map((m) => {
    const daily = end ? lastN(byDay, m.key, end, 30) : [];
    const all = present(days.map((d) => d[m.key]));
    const bars = mode === "recent" ? daily : end ? weekly(byDay, m.key, end, 26) : [];
    const a7 = mean(present(daily.slice(-7)));
    const base = mode === "recent" ? mean(present(daily)) : mean(all);
    const delta = a7 != null && base != null ? round1(a7 - base) : null;
    return {
      key: m.key,
      label: m.label,
      unit: m.unit ?? "",
      bars,
      avg7: a7 != null ? round1(a7) : null,
      avg30: base != null ? round1(base) : null,
      delta,
      good: delta == null || delta === 0 ? null : m.lowerBetter ? delta < 0 : delta > 0,
      all,
    };
  });
}

/** Weekly averages of one metric for the n weeks ending at `end` (oldest → newest, null = no data). */
function weekly(byDay: Map<string, WhoopDay>, key: MetricKey, end: string, n: number): (number | null)[] {
  const daily = lastN(byDay, key, end, n * 7);
  return Array.from({ length: n }, (_, w) => mean(present(daily.slice(w * 7, w * 7 + 7))));
}

export type MonthRow = { month: string; label: string; avg: number; days: number };

/** Average race score per calendar month, oldest → newest (only months with scored days). */
export function monthly(days: WhoopDay[]): MonthRow[] {
  const byMonth = new Map<string, number[]>();
  for (const d of days) {
    if (d.score == null) continue;
    const m = d.day.slice(0, 7);
    byMonth.set(m, [...(byMonth.get(m) ?? []), d.score]);
  }
  return Array.from(byMonth, ([month, xs]) => ({
    month,
    label: new Date(`${month}-01T00:00:00Z`).toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
    avg: round1(mean(xs) as number),
    days: xs.length,
  })).sort((a, b) => (a.month < b.month ? -1 : 1));
}

const MIN_SAMPLES = 5; // yes days and no days each, so one-offs don't read as insights

export type JournalImpact = {
  question: string;
  yesDays: number;
  answered: number;
  recoveryDiff: number; // next-day recovery on "yes" days minus "no" days
  sleepDiff: number | null; // same for next-day sleep performance
  thisWeek: number; // "yes" answers in the last 7 journal days
};

/**
 * For each journal question with enough "yes" and "no" days, how next-day recovery
 * (and sleep) differ — e.g. alcohol. Biggest effect first.
 */
export function journalImpacts(journal: JournalRow[], days: WhoopDay[]): JournalImpact[] {
  const next = new Map(days.map((d) => [d.day, d]));
  const lastJournalDay = journal.reduce((m, j) => (j.day > m ? j.day : m), "");
  const weekStart = lastJournalDay ? addDays(lastJournalDay, -6) : "";
  const byQuestion = new Map<string, { yes: WhoopDay[]; no: WhoopDay[]; answered: number; yesDays: number; week: number }>();
  for (const j of journal) {
    if (j.answered_yes == null) continue;
    const q = byQuestion.get(j.question) ?? { yes: [], no: [], answered: 0, yesDays: 0, week: 0 };
    q.answered++;
    if (j.answered_yes) {
      q.yesDays++;
      if (j.day >= weekStart) q.week++;
    }
    const nd = next.get(addDays(j.day, 1));
    if (nd) (j.answered_yes ? q.yes : q.no).push(nd);
    byQuestion.set(j.question, q);
  }
  const avgOf = (ds: WhoopDay[], k: "recovery" | "sleep") => mean(present(ds.map((d) => d[k])));
  const out: JournalImpact[] = [];
  for (const [question, q] of byQuestion) {
    if (q.yes.length < MIN_SAMPLES || q.no.length < MIN_SAMPLES) continue;
    const ry = avgOf(q.yes, "recovery");
    const rn = avgOf(q.no, "recovery");
    if (ry == null || rn == null) continue;
    const sy = avgOf(q.yes, "sleep");
    const sn = avgOf(q.no, "sleep");
    out.push({
      question,
      yesDays: q.yesDays,
      answered: q.answered,
      recoveryDiff: round1(ry - rn),
      sleepDiff: sy != null && sn != null ? round1(sy - sn) : null,
      thisWeek: q.week,
    });
  }
  return out.sort((a, b) => Math.abs(b.recoveryDiff) - Math.abs(a.recoveryDiff));
}
