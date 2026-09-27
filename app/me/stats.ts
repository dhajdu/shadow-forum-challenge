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

/** Per-metric 7- vs 30-day view, anchored on the newest uploaded day (uploads lag behind today). */
export function trends(days: WhoopDay[]): TrendRow[] {
  const end = days.length ? days[days.length - 1].day : null;
  const byDay = new Map(days.map((d) => [d.day, d]));
  return METRICS.map((m) => {
    const bars = end ? lastN(byDay, m.key, end, 30) : [];
    const a7 = mean(present(bars.slice(-7)));
    const a30 = mean(present(bars));
    const delta = a7 != null && a30 != null ? round1(a7 - a30) : null;
    return {
      key: m.key,
      label: m.label,
      unit: m.unit ?? "",
      bars,
      avg7: a7 != null ? round1(a7) : null,
      avg30: a30 != null ? round1(a30) : null,
      delta,
      good: delta == null || delta === 0 ? null : m.lowerBetter ? delta < 0 : delta > 0,
      all: present(days.map((d) => d[m.key])),
    };
  });
}

const MIN_SAMPLES = 3;

/**
 * The journal question whose "yes" days show the biggest next-day recovery difference,
 * e.g. alcohol. Null when no question has enough yes and no days to compare.
 */
export function journalInsight(journal: JournalRow[], days: WhoopDay[]): string | null {
  const reco = new Map(days.filter((d) => d.recovery != null).map((d) => [d.day, d.recovery as number]));
  const byQuestion = new Map<string, { yes: number[]; no: number[] }>();
  for (const j of journal) {
    const next = reco.get(addDays(j.day, 1));
    if (j.answered_yes == null || next == null) continue;
    const q = byQuestion.get(j.question) ?? { yes: [], no: [] };
    (j.answered_yes ? q.yes : q.no).push(next);
    byQuestion.set(j.question, q);
  }
  let best: { question: string; diff: number } | null = null;
  for (const [question, { yes, no }] of byQuestion) {
    if (yes.length < MIN_SAMPLES || no.length < MIN_SAMPLES) continue;
    const diff = (mean(yes) as number) - (mean(no) as number);
    if (Math.abs(diff) >= 1 && (!best || Math.abs(diff) > Math.abs(best.diff))) best = { question, diff };
  }
  if (!best) return null;
  const pts = Math.round(Math.abs(best.diff));
  return `On days you answered yes to “${best.question}”, next-day recovery averaged ${pts} points ${
    best.diff < 0 ? "lower" : "higher"
  }.`;
}
