// Contest rules for display, shared by mobile/ (and website/ once it moves).
// Mirrors lib/contest.ts and lib/standings.ts. Scores are computed server-side;
// this only ranks and labels them.

export const CONTEST_START_DAY = "2026-09-23";
export const CONTEST_END_DAY = "2026-12-22";
export const CONTEST_DAYS = 91;
/** Placement penalties in VND millions: 1st pays 0, then 2M..5M. */
export const PLACEMENT_PENALTIES = [0, 2, 3, 4, 5];
export const MISSED_GOAL_PENALTY = 5;
export const COACH_SHARE_PENALTY = 5;
export const STALE_DAYS = 7;
export const STRAIN_MAX = 21;
export const FORMULA = "Day score = (Recovery % + Sleep % + Strain ÷ 21 × 100) ÷ 3";

export const today = (now = new Date()) => now.toISOString().slice(0, 10);

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** 1-based day of the contest, clamped to 0..CONTEST_DAYS. */
export function dayOfContest(day = today()): number {
  return Math.max(0, Math.min(CONTEST_DAYS, daysBetween(CONTEST_START_DAY, day) + 1));
}

export function placementPenalty(rankIndex: number): number {
  return PLACEMENT_PENALTIES[Math.min(rankIndex, PLACEMENT_PENALTIES.length - 1)];
}

export function isStale(lastDataDay: string | null, day = today()): boolean {
  return !lastDataDay || lastDataDay < addDays(day, -STALE_DAYS);
}

type Rankable = { full_name: string; contest_avg: number; contest_days: number };

/** Highest contest average first; riders with no scored days go last, by name. */
export function ranked<T extends Rankable>(rows: T[]): T[] {
  return [...rows].sort(
    (x, y) =>
      Number(y.contest_days > 0) - Number(x.contest_days > 0) ||
      y.contest_avg - x.contest_avg ||
      x.full_name.localeCompare(y.full_name),
  );
}

export function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export const one = (x: number) => {
  const r = Math.round(x * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

/** Score (0–100) → red ≤40, amber 65, blue ≥90, interpolated. Same stops as web and iOS. */
export function scoreColor(s: number): string {
  const stops: [number, [number, number, number]][] = [
    [40, [255, 67, 38]],
    [65, [245, 165, 36]],
    [90, [47, 125, 255]],
  ];
  const x = Math.max(40, Math.min(90, s));
  const i = x <= 65 ? 0 : 1;
  const [x0, c0] = stops[i];
  const [x1, c1] = stops[i + 1];
  const t = (x - x0) / (x1 - x0);
  const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
