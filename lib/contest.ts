// Contest constants and helpers shared across the app.
//
// Seasons live in the seasons table (starts_on, ends_on, metric, ladder). Use the
// season helpers below. The CONTEST_* constants are Q4 2026 only, kept until the
// pages that import them take a season.

export const CONTEST_START = new Date("2026-09-23T00:00:00Z");
export const CONTEST_END = new Date("2026-12-22T23:59:59Z");
export const CONTEST_DAYS = 91;
export const CONTEST_START_DAY = "2026-09-23"; // YYYY-MM-DD, for filtering whoop_days

// Placement penalties (VND millions): 1st pays 0, then 2M..5M.
export const PLACEMENT_PENALTIES = [0, 2, 3, 4, 5];
export const MISSED_GOAL_PENALTY = 5; // rider
export const COACH_SHARE_PENALTY = 5; // coach

export function dayOfContest(now = new Date()): number {
  const ms = now.getTime() - CONTEST_START.getTime();
  const day = Math.floor(ms / 86_400_000) + 1;
  return Math.max(0, Math.min(CONTEST_DAYS, day));
}

export function currentLeg(now = new Date()): string {
  if (now < CONTEST_START) return "pre-season";
  if (now > CONTEST_END) return "final";
  return now.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

/** Penalty owed for a 0-based placement (rank-1). */
export function placementPenalty(rankIndex: number): number {
  return PLACEMENT_PENALTIES[Math.min(rankIndex, PLACEMENT_PENALTIES.length - 1)];
}

// ── Seasons ─────────────────────────────────────────────
export type ContestSeason = {
  id: string;
  slug: string;
  name: string;
  starts_on: string; // YYYY-MM-DD
  ends_on: string;
  metric?: string | null;
  ladder?: unknown;
};

const DAY_MS = 86_400_000;
const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const todayStr = (now = new Date()) => now.toISOString().slice(0, 10);

/** The season a day belongs to: the latest one that had started (same as public.season_of). */
export function seasonForDay<T extends Pick<ContestSeason, "starts_on">>(seasons: T[], day = todayStr()): T | null {
  let best: T | null = null;
  for (const s of seasons) if (s.starts_on <= day && (!best || s.starts_on > best.starts_on)) best = s;
  return best;
}

/** The season to lock goals into: the newest one, started or not (e.g. Q1 2027 during December). */
export function newestSeason<T extends Pick<ContestSeason, "starts_on">>(seasons: T[]): T | null {
  return seasons.reduce<T | null>((a, s) => (!a || s.starts_on > a.starts_on ? s : a), null);
}

export function seasonLength(s: Pick<ContestSeason, "starts_on" | "ends_on">): number {
  return Math.round((dayMs(s.ends_on) - dayMs(s.starts_on)) / DAY_MS) + 1;
}

/** 1-based day of the season, clamped to 0..length. */
export function dayOfSeason(s: Pick<ContestSeason, "starts_on" | "ends_on">, now = new Date()): number {
  const day = Math.floor((dayMs(todayStr(now)) - dayMs(s.starts_on)) / DAY_MS) + 1;
  return Math.max(0, Math.min(seasonLength(s), day));
}

export function seasonPhase(s: Pick<ContestSeason, "starts_on" | "ends_on">, now = new Date()): "upcoming" | "running" | "over" {
  const t = todayStr(now);
  return t < s.starts_on ? "upcoming" : t > s.ends_on ? "over" : "running";
}

/** Placement penalties (VND millions) for the season, from its ladder; Q4's ladder if unset. */
export function seasonLadder(s: Pick<ContestSeason, "ladder"> | null): number[] {
  const l = s?.ladder;
  return Array.isArray(l) && l.length && l.every((x) => typeof x === "number") ? (l as number[]) : PLACEMENT_PENALTIES;
}

export function seasonPenalty(s: Pick<ContestSeason, "ladder"> | null, rankIndex: number): number {
  const ladder = seasonLadder(s);
  return ladder[Math.min(rankIndex, ladder.length - 1)];
}
