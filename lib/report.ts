import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, GoalStatus } from "@/lib/database.types";
import { getStandings } from "@/lib/standings";
import { seasonForDay, seasonPenalty, type ContestSeason } from "@/lib/contest";
import { contestTracks, rulesOf, SEASON_RULE_COLUMNS, type ContestRules } from "@/lib/goal-points";
import { getContestBoard } from "@/lib/goal-standings";
import { getForumSettings } from "@/lib/forum-settings";
import { todayIn } from "@/app/_data/format";

export type GoalResult = {
  title: string;
  points: number;
  streak: number;
  pct: number | null;
  checkins: number;
  missed: number;
  hit: boolean;
};

export type ReportRow = {
  user_id: string;
  name: string;
  avg: number;
  rank: number;
  delta: number | null; // rank change vs ~a month ago (+ = moved up)
  goalStatus: GoalStatus;
  owes: number; // placement stake, whole units of the forum's currency
  points: number | null; // goal-scored seasons: total points
  goal: GoalResult | null; // goal-scored seasons: the goal's results
};

export type Report = {
  standings: ReportRow[];
  topMover: ReportRow | null;
  topFaller: ReportRow | null;
  rules: ContestRules;
  tracks: { goals: boolean; whoop: boolean };
};

type ReportSeason = Pick<ContestSeason, "id" | "starts_on" | "ends_on"> & Parameters<typeof rulesOf>[0];

const empty = (rules = rulesOf(null)): Report => ({ standings: [], topMover: null, topFaller: null, rules, tracks: { goals: false, whoop: false } });

/**
 * The report for one season's board, with stakes from that season's rules.
 * Without a season: the season running today. A season scored on goals ranks
 * on points (goal check-ins, plus WHOOP when it scores both) and carries each
 * member's goal results; a WHOOP race ranks on the average score as before.
 */
export async function buildReport(supabase: SupabaseClient<Database>, seasonArg?: ReportSeason): Promise<Report> {
  const forum = await getForumSettings();
  const today = todayIn(forum.timeZone);
  let season = seasonArg;
  if (!season) {
    const { data } = await supabase.from("seasons").select(`id, starts_on, ends_on, ${SEASON_RULE_COLUMNS}`);
    const now = seasonForDay((data ?? []) as ReportSeason[], today);
    if (!now) return empty();
    season = now;
  }
  const rules = rulesOf(season);
  const tracks = contestTracks(rules, forum.whoopEnabled);

  // public goal statuses, this season's goals
  const { data: goals } = await supabase.from("goals").select("user_id, current_status").eq("season_id", season.id);
  const statusByUser = new Map<string, GoalStatus>();
  for (const g of (goals ?? []) as { user_id: string; current_status: GoalStatus }[]) statusByUser.set(g.user_id, g.current_status);

  if (tracks.goals) {
    const board = await getContestBoard(supabase, season, { whoopEnabled: forum.whoopEnabled, today });
    const standings: ReportRow[] = board.rows.map((r) => ({
      user_id: r.user_id,
      name: r.full_name,
      avg: r.whoopAvg ?? 0,
      rank: r.rank,
      delta: null,
      goalStatus: r.goal?.status ?? statusByUser.get(r.user_id) ?? "on_track",
      owes: r.stake,
      points: r.points,
      goal:
        r.goal && r.score
          ? {
              title: r.goal.title,
              points: r.goalPoints,
              streak: r.score.bestStreak,
              pct: r.score.pct,
              checkins: r.score.checkins,
              missed: r.score.missed.length,
              hit: r.score.hitGoal,
            }
          : null,
    }));
    return { standings, topMover: null, topFaller: null, rules, tracks };
  }

  // movement: compare against the oldest snapshot in the last ~35 days
  const since = new Date();
  since.setDate(since.getDate() - 35);
  const [standings, { data: snaps }] = await Promise.all([
    getStandings(supabase, season.id),
    supabase
      .from("standings_snapshots")
      .select("day, data")
      .gte("day", since.toISOString().slice(0, 10))
      .order("day", { ascending: true })
      .limit(1),
  ]);

  const prevRank = new Map<string, number>();
  const first = (snaps ?? [])[0] as { data: unknown } | undefined;
  const firstData = (first?.data ?? []) as { user_id: string; rank: number }[];
  for (const d of firstData) prevRank.set(d.user_id, d.rank);

  const rows: ReportRow[] = standings.map((s, i) => {
    const rank = i + 1;
    const prev = prevRank.get(s.user_id);
    return {
      user_id: s.user_id,
      name: s.full_name,
      avg: s.avg,
      rank,
      delta: prev != null ? prev - rank : null,
      goalStatus: statusByUser.get(s.user_id) ?? "on_track",
      owes: seasonPenalty(season, i),
      points: null,
      goal: null,
    };
  });

  const withDelta = rows.filter((r) => r.delta != null) as (ReportRow & { delta: number })[];
  const topMover = withDelta.length
    ? withDelta.reduce((a, b) => (b.delta > a.delta ? b : a))
    : null;
  const topFaller = withDelta.length
    ? withDelta.reduce((a, b) => (b.delta < a.delta ? b : a))
    : null;

  return { standings: rows, topMover, topFaller, rules, tracks };
}
