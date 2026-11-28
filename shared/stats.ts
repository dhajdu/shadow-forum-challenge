// Presentation helpers ported from the iOS app's Stats.swift (itself from the web's app/me/stats.ts).
// They only arrange rows the server already scored. No scoring happens here.
import { addDays, CONTEST_START_DAY, STRAIN_MAX, today } from "./contest";

export type Day = {
  day: string;
  score: number | null;
  recovery: number | null;
  sleep: number | null;
  strain: number | null;
  resting_hr?: number | null;
  hrv?: number | null;
};

export const round1 = (x: number) => Math.round(x * 10) / 10;
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const strainPct = (s: number) => Math.min(100, (s / STRAIN_MAX) * 100);
const one = (x: number) => String(round1(x));

export type MetricKey = "score" | "recovery" | "sleep" | "strain" | "hrv" | "resting_hr";
export const METRICS: { key: MetricKey; label: string; unit: string; lowerIsBetter?: boolean }[] = [
  { key: "score", label: "Race score", unit: "" },
  { key: "recovery", label: "Recovery", unit: "%" },
  { key: "sleep", label: "Sleep", unit: "%" },
  { key: "strain", label: "Strain", unit: "" },
  { key: "hrv", label: "HRV", unit: "ms" },
  { key: "resting_hr", label: "Resting HR", unit: "bpm", lowerIsBetter: true },
];
const val = (d: Day | undefined, k: MetricKey): number | null => (d ? (d[k] ?? null) : null);

export type Latest = {
  day: string;
  score: number;
  delta: number | null;
  parts: { label: string; pct: number; text: string }[];
  note: string;
};

export function latestDay(days: Day[]): Latest | null {
  const scored = days.filter((d) => d.score != null);
  const last = scored[scored.length - 1];
  if (!last || last.score == null) return null;
  const prior = mean(scored.filter((d) => d.day < last.day && d.day >= addDays(last.day, -30)).map((d) => d.score!));
  const parts = [
    { label: "Recovery", pct: last.recovery ?? 0, text: last.recovery != null ? `${one(last.recovery)}%` : "—" },
    { label: "Sleep", pct: last.sleep ?? 0, text: last.sleep != null ? `${one(last.sleep)}%` : "—" },
    { label: "Strain", pct: strainPct(last.strain ?? 0), text: last.strain != null ? `${one(last.strain)}/${STRAIN_MAX}` : "—" },
  ];
  const sorted = [...parts].sort((a, b) => b.pct - a.pct);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  return {
    day: last.day,
    score: last.score,
    delta: prior == null ? null : round1(last.score - prior),
    parts,
    note: `${best.label} carried the day (${best.text}); ${worst.label.toLowerCase()} held it back (${worst.text}).`,
  };
}

export type CellState = "scored" | "missed" | "pending";
export type Cell = { day: string; state: CellState; score: number | null };

/** One cell per contest day up to today: scored, missed (inside the uploaded range) or not uploaded yet. */
export function contestStrip(days: Day[], start = CONTEST_START_DAY, end = today()): Cell[] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const lastData = days[days.length - 1]?.day;
  const cells: Cell[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const score = byDay.get(day)?.score ?? null;
    cells.push({ day, score, state: score != null ? "scored" : lastData && day <= lastData ? "missed" : "pending" });
  }
  return cells;
}

export function currentStreak(cells: Cell[]): number {
  let n = 0;
  for (const c of cells.filter((c) => c.state !== "pending").reverse()) {
    if (c.state !== "scored") break;
    n++;
  }
  return n;
}

export type TrendMode = "recent" | "all";
export type Trend = {
  key: MetricKey;
  label: string;
  unit: string;
  bars: (number | null)[];
  avg7: number | null;
  base: number | null;
  delta: number | null;
  good: boolean | null;
};

function lastN(byDay: Map<string, Day>, k: MetricKey, end: string, n: number) {
  return Array.from({ length: n }, (_, i) => val(byDay.get(addDays(end, i - n + 1)), k));
}

/** Anchored on the newest uploaded day (uploads lag behind today). */
export function trends(days: Day[], mode: TrendMode): Trend[] {
  const end = days[days.length - 1]?.day;
  const byDay = new Map(days.map((d) => [d.day, d]));
  return METRICS.map((m) => {
    const daily = end ? lastN(byDay, m.key, end, 30) : [];
    const all = days.map((d) => val(d, m.key)).filter((v): v is number => v != null);
    let bars: (number | null)[] = [];
    if (mode === "recent") bars = daily;
    else if (end) {
      const long = lastN(byDay, m.key, end, 26 * 7);
      bars = Array.from({ length: 26 }, (_, w) => mean(long.slice(w * 7, w * 7 + 7).filter((v): v is number => v != null)));
    }
    const a7 = mean(daily.slice(-7).filter((v): v is number => v != null));
    const base = mode === "recent" ? mean(daily.filter((v): v is number => v != null)) : mean(all);
    const delta = a7 != null && base != null ? round1(a7 - base) : null;
    const good = delta == null || delta === 0 ? null : m.lowerIsBetter ? delta < 0 : delta > 0;
    return { key: m.key, label: m.label, unit: m.unit, bars, avg7: a7 == null ? null : round1(a7), base: base == null ? null : round1(base), delta, good };
  });
}

export type Month = { month: string; avg: number; days: number };

export function monthly(days: Day[]): Month[] {
  const by = new Map<string, number[]>();
  for (const d of days) if (d.score != null) by.set(d.day.slice(0, 7), [...(by.get(d.day.slice(0, 7)) ?? []), d.score]);
  return [...by.entries()].map(([month, xs]) => ({ month, avg: round1(mean(xs)!), days: xs.length })).sort((a, b) => a.month.localeCompare(b.month));
}

export type DayStatus = "scored" | "in progress" | "missed";

/** Every contest day from the start to the newest uploaded day, newest first. */
export function contestRows(days: Day[]): { day: string; data: Day | null; status: DayStatus }[] {
  const newest = days[days.length - 1]?.day;
  if (!newest || newest < CONTEST_START_DAY) return [];
  const byDay = new Map(days.map((d) => [d.day, d]));
  const rows: { day: string; data: Day | null; status: DayStatus }[] = [];
  for (let day = newest; day >= CONTEST_START_DAY; day = addDays(day, -1)) {
    const d = byDay.get(day) ?? null;
    const complete = d?.recovery != null && d?.sleep != null && d?.strain != null;
    rows.push({ day, data: d, status: d?.score == null ? "missed" : complete ? "scored" : "in progress" });
  }
  return rows;
}

export type Snapshot = { day: string; data: { user_id: string; rank: number }[] };

/** Rank change per rider vs a snapshot (+ = moved up). */
export function rankDeltas(ranked: { user_id: string }[], snapshot: Snapshot | null): Record<string, number> {
  if (!snapshot) return {};
  const prev = new Map(snapshot.data.map((e) => [e.user_id, e.rank]));
  const out: Record<string, number> = {};
  ranked.forEach((s, i) => {
    const p = prev.get(s.user_id);
    if (p != null) out[s.user_id] = p - (i + 1);
  });
  return out;
}
