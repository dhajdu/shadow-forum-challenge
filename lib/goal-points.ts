// Goal-scored contests: a season's rules and the points a goal earns from its
// check-ins (migration 0034). Pure functions, no database: the board, the
// check-in form, the report and the fines cron all score through here.
//
// The season is split into check-in periods of checkin_days from its first day
// (the last one ends with the season). In each period the newest check-in counts:
//   points_checkin                       for checking in
//   points_progress × current / target   for progress toward the goal (capped at 100%)
//   points_streak                        when the period before also had a check-in
// and points_goal once, when a check-in reaches the target (or the goal is marked hit).
// A period that ended without a check-in is missed (a fine, if the season sets one).

import type { ContestScoring } from "@/lib/database.types";

export type { ContestScoring };

export type ContestRules = {
  contestName: string | null;
  scoring: ContestScoring | null; // null: no contest picked
  checkinDays: number;
  pointsCheckin: number;
  pointsProgress: number;
  pointsStreak: number;
  pointsGoal: number;
  missedCheckinFine: number | null; // whole units of the forum's currency
  missedGoalFine: number | null;
  coachShareFine: number | null;
  ladder: number[]; // placement stakes, whole units: 1st pays ladder[0]
};

/** The plan's defaults (Forum Manager, "Default contest rules"). */
export const DEFAULT_RULES: ContestRules = {
  contestName: null,
  scoring: "goals",
  checkinDays: 7,
  pointsCheckin: 10,
  pointsProgress: 50,
  pointsStreak: 10,
  pointsGoal: 100,
  missedCheckinFine: null,
  missedGoalFine: null,
  coachShareFine: null,
  ladder: [],
};

export const CHECKIN_RHYTHMS: { days: number; label: string }[] = [
  { days: 7, label: "Weekly" },
  { days: 14, label: "Every two weeks" },
  { days: 28, label: "Every four weeks" },
];

export const rhythmLabel = (days: number) => CHECKIN_RHYTHMS.find((r) => r.days === days)?.label ?? `Every ${days} days`;
/** "week" / "fortnight" / "period" */
export const periodWord = (days: number) => (days === 7 ? "week" : days === 14 ? "fortnight" : "period");

/** The season row's rule columns (any of them may be missing on older selects). */
export type SeasonRuleColumns = {
  contest_name?: string | null;
  scoring?: string | null;
  checkin_days?: number | null;
  points_checkin?: number | null;
  points_progress?: number | null;
  points_streak?: number | null;
  points_goal?: number | null;
  missed_checkin_fine?: number | string | null;
  missed_goal_fine?: number | string | null;
  coach_share_fine?: number | string | null;
  ladder?: unknown;
};

/** The column list to select for rulesOf. */
export const SEASON_RULE_COLUMNS =
  "contest_name, scoring, checkin_days, points_checkin, points_progress, points_streak, points_goal, missed_checkin_fine, missed_goal_fine, coach_share_fine, ladder";

const money = (v: number | string | null | undefined) => (v == null || v === "" ? null : Number(v) > 0 ? Number(v) : null);
const int = (v: number | null | undefined, d: number) => (v == null || !Number.isFinite(Number(v)) ? d : Number(v));

export function rulesOf(s: SeasonRuleColumns | null | undefined): ContestRules {
  const scoring = s?.scoring === "goals" || s?.scoring === "whoop" || s?.scoring === "both" ? s.scoring : null;
  const l = s?.ladder;
  return {
    contestName: s?.contest_name?.trim() || null,
    scoring,
    checkinDays: int(s?.checkin_days, DEFAULT_RULES.checkinDays),
    pointsCheckin: int(s?.points_checkin, DEFAULT_RULES.pointsCheckin),
    pointsProgress: int(s?.points_progress, DEFAULT_RULES.pointsProgress),
    pointsStreak: int(s?.points_streak, DEFAULT_RULES.pointsStreak),
    pointsGoal: int(s?.points_goal, DEFAULT_RULES.pointsGoal),
    missedCheckinFine: money(s?.missed_checkin_fine),
    missedGoalFine: money(s?.missed_goal_fine),
    coachShareFine: money(s?.coach_share_fine),
    ladder: Array.isArray(l) && l.every((x) => typeof x === "number") ? (l as number[]) : [],
  };
}

/** Which tracks a season runs, given whether the forum has WHOOP switched on. */
export function contestTracks(rules: Pick<ContestRules, "scoring">, whoopEnabled: boolean): { goals: boolean; whoop: boolean } {
  const s = rules.scoring;
  return { goals: s === "goals" || s === "both", whoop: whoopEnabled && (s === "whoop" || s === "both") };
}

// ── Periods ─────────────────────────────────────────────
const DAY = 86_400_000;
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => iso(ms(d) + n * DAY);

export type Period = { index: number; start: string; end: string };

/** The season's check-in periods, from its first day; the last one ends with the season. */
export function seasonPeriods(s: { starts_on: string; ends_on: string }, days: number): Period[] {
  const n = Math.max(1, Math.round(days));
  const out: Period[] = [];
  for (let i = 0, start = s.starts_on; start <= s.ends_on; i++, start = addDays(start, n)) {
    const end = addDays(start, n - 1);
    out.push({ index: i, start, end: end > s.ends_on ? s.ends_on : end });
  }
  return out;
}

/** The period a day falls in, or null outside the season. */
export function periodOf(periods: Period[], day: string): Period | null {
  return periods.find((p) => p.start <= day && day <= p.end) ?? null;
}

// ── Scoring ─────────────────────────────────────────────
export type Checkin = { on: string; value: number };

export type GoalInput = {
  season: { starts_on: string; ends_on: string };
  rules: ContestRules;
  target: number | null;
  hit?: boolean; // the goal is marked hit
  checkins: Checkin[];
  /** First day the member owes check-ins: the later of joining the forum and setting the goal. */
  eligibleFrom?: string | null;
  leftOn?: string | null;
  today: string; // YYYY-MM-DD in the forum's time zone
};

export type GoalScore = {
  points: number;
  checkinPoints: number;
  progressPoints: number;
  streakPoints: number;
  goalPoints: number;
  checkins: number; // periods with a check-in
  streak: number; // periods in a row with a check-in, up to now
  bestStreak: number;
  pct: number | null; // newest value / target
  latest: Checkin | null;
  missed: Period[]; // ended periods the member owed and missed
  owedPeriods: number; // ended periods the member owed
  checkedInNow: boolean; // already checked in this period
  nextDue: string | null; // last day of the period the next check-in is due in
  hitGoal: boolean;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Progress points for one check-in: points_progress scaled by value / target, rounded. */
export function progressPoints(value: number, target: number | null, max: number): number {
  if (!target || target <= 0) return 0;
  return Math.round(max * clamp01(value / target));
}

export function scoreGoal(g: GoalInput): GoalScore {
  const { rules, today } = g;
  const periods = seasonPeriods(g.season, rules.checkinDays);
  const counted = new Map<number, Checkin>(); // newest check-in per period, up to today
  for (const c of g.checkins) {
    if (c.on > today) continue;
    const p = periodOf(periods, c.on);
    if (!p) continue;
    const cur = counted.get(p.index);
    if (!cur || c.on >= cur.on) counted.set(p.index, c);
  }

  let checkinPoints = 0;
  let progress = 0;
  let streakPoints = 0;
  let run = 0;
  let best = 0;
  let prevHad = false;
  const missed: Period[] = [];
  let owed = 0;
  let latest: Checkin | null = null;
  let hitGoal = !!g.hit;
  const from = g.eligibleFrom ?? g.season.starts_on;

  for (const p of periods) {
    if (p.start > today) break;
    const c = counted.get(p.index);
    const ended = p.end < today;
    const owes = p.end >= from && !(g.leftOn && g.leftOn <= p.start);
    if (c) {
      checkinPoints += rules.pointsCheckin;
      progress += progressPoints(c.value, g.target, rules.pointsProgress);
      if (prevHad) streakPoints += rules.pointsStreak;
      run = prevHad ? run + 1 : 1;
      best = Math.max(best, run);
      prevHad = true;
      latest = c;
      if (g.target != null && g.target > 0 && c.value >= g.target) hitGoal = true;
      if (ended && owes) owed++;
    } else if (ended) {
      if (owes) {
        owed++;
        missed.push(p);
      }
      run = 0;
      prevHad = false;
    }
    // the period running today without a check-in yet: the streak is not broken
  }

  const now = periodOf(periods, today);
  const checkedInNow = !!now && counted.has(now.index);
  let nextDue: string | null = null;
  if (now) nextDue = checkedInNow ? (periods[now.index + 1]?.end ?? null) : now.end;
  else if (today < g.season.starts_on) nextDue = periods[0]?.end ?? null;

  const goalPoints = hitGoal ? rules.pointsGoal : 0;
  return {
    points: checkinPoints + progress + streakPoints + goalPoints,
    checkinPoints,
    progressPoints: progress,
    streakPoints,
    goalPoints,
    checkins: counted.size,
    streak: run,
    bestStreak: best,
    pct: latest && g.target && g.target > 0 ? Math.round(clamp01(latest.value / g.target) * 100) : null,
    latest,
    missed,
    owedPeriods: owed,
    checkedInNow,
    nextDue,
    hitGoal,
  };
}

/**
 * The points one more check-in would add today (for the check-in form): the
 * check-in, progress and streak points of this period, minus what this
 * period's earlier check-in already earned, plus the goal bonus if this is the first hit.
 */
export function checkinGain(g: GoalInput, value: number): { checkin: number; progress: number; streak: number; goal: number; total: number } {
  const before = scoreGoal(g);
  const after = scoreGoal({ ...g, checkins: [...g.checkins.filter((c) => c.on !== g.today), { on: g.today, value }] });
  const checkin = after.checkinPoints - before.checkinPoints;
  const progress = after.progressPoints - before.progressPoints;
  const streak = after.streakPoints - before.streakPoints;
  const goal = after.goalPoints - before.goalPoints;
  return { checkin, progress, streak, goal, total: checkin + progress + streak + goal };
}

/**
 * The WHOOP track in a 'both' season: each period that has started is worth up
 * to points_progress, scaled by the rider's average WHOOP score (0 to 100).
 */
export function whoopPoints(avg: number, season: { starts_on: string; ends_on: string }, rules: ContestRules, today: string): number {
  const started = seasonPeriods(season, rules.checkinDays).filter((p) => p.start <= today).length;
  return Math.round(clamp01(avg / 100) * rules.pointsProgress * started);
}

/** Placement stake for a 0-based rank. */
export function ladderStake(rules: Pick<ContestRules, "ladder">, rankIndex: number): number {
  const l = rules.ladder;
  return l.length ? l[Math.min(rankIndex, l.length - 1)] : 0;
}
