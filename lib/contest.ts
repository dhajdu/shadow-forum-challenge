// Contest constants and helpers shared across the app.

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
