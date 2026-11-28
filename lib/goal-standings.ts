// The goal-scored contest board for one season: season_goal_board (goals and
// their check-ins, under RLS) scored by lib/goal-points, plus the WHOOP race
// (season_standings) when the season scores both. Used by the contest pages,
// Home, the report, the Bookkeeper and the check-in fines cron.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, GoalStatus } from "@/lib/database.types";
import { getStandings } from "@/lib/standings";
import type { ContestSeason } from "@/lib/contest";
import {
  contestTracks,
  ladderStake,
  rulesOf,
  scoreGoal,
  whoopPoints,
  type Checkin,
  type ContestRules,
  type GoalInput,
  type GoalScore,
} from "@/lib/goal-points";

type Db = SupabaseClient<Database>;
type BoardViewRow = Database["public"]["Views"]["season_goal_board"]["Row"];

export type GoalOnBoard = {
  goalId: string;
  title: string;
  unit: string | null;
  target: number | null;
  status: GoalStatus;
  checkins: Checkin[];
  input: GoalInput; // to score a new check-in (checkinGain)
};

export type BoardRow = {
  user_id: string;
  full_name: string;
  rank: number;
  points: number; // goal points + WHOOP points
  goalPoints: number;
  whoopPoints: number;
  whoopAvg: number | null; // only when the WHOOP track runs
  score: GoalScore | null; // null: no goal set
  goal: GoalOnBoard | null;
  stake: number; // placement stake today, whole units
};

export type Board = { rules: ContestRules; tracks: { goals: boolean; whoop: boolean }; rows: BoardRow[] };

const later = (...ds: (string | null | undefined)[]) => ds.filter((d): d is string => !!d).sort().pop() ?? null;

/** Score a season's board as of `today` (YYYY-MM-DD in the forum's time zone). */
export async function getContestBoard(
  db: Db,
  season: Pick<ContestSeason, "id" | "starts_on" | "ends_on"> & Parameters<typeof rulesOf>[0],
  opts: { whoopEnabled: boolean; today: string }
): Promise<Board> {
  const rules = rulesOf(season);
  const tracks = contestTracks(rules, opts.whoopEnabled);
  const span = { starts_on: season.starts_on, ends_on: season.ends_on };

  const [goalRows, whoop] = await Promise.all([
    tracks.goals
      ? db.from("season_goal_board").select("*").eq("season_id", season.id).then((r) => {
          if (r.error) throw new Error(r.error.message);
          return (r.data ?? []) as BoardViewRow[];
        })
      : Promise.resolve([] as BoardViewRow[]),
    tracks.whoop ? getStandings(db, season.id) : Promise.resolve([]),
  ]);

  const byUser = new Map<string, Omit<BoardRow, "rank" | "stake">>();
  for (const g of goalRows) {
    const checkins = ((g.checkins ?? []) as Checkin[]).map((c) => ({ on: c.on, value: Number(c.value) }));
    const input: GoalInput = {
      season: span,
      rules,
      target: g.target_value,
      hit: g.current_status === "hit",
      checkins,
      eligibleFrom: later(season.starts_on, g.forum_joined_on, g.goal_set_at?.slice(0, 10)),
      leftOn: g.forum_left_on,
      today: opts.today,
    };
    const score = scoreGoal(input);
    byUser.set(g.user_id, {
      user_id: g.user_id,
      full_name: g.full_name,
      points: score.points,
      goalPoints: score.points,
      whoopPoints: 0,
      whoopAvg: null,
      score,
      goal: { goalId: g.goal_id, title: g.title, unit: g.unit, target: g.target_value, status: g.current_status, checkins, input },
    });
  }
  for (const w of whoop) {
    const wp = w.days > 0 ? whoopPoints(w.avg, span, rules, opts.today) : 0;
    const row = byUser.get(w.user_id) ?? {
      user_id: w.user_id,
      full_name: w.full_name,
      points: 0,
      goalPoints: 0,
      whoopPoints: 0,
      whoopAvg: null,
      score: null,
      goal: null,
    };
    row.whoopPoints = wp;
    row.whoopAvg = w.days > 0 ? w.avg : null;
    row.points = row.goalPoints + wp;
    byUser.set(w.user_id, row);
  }

  const rows = [...byUser.values()]
    .sort((a, b) => b.points - a.points || a.full_name.localeCompare(b.full_name))
    .map((r, i) => ({ ...r, rank: i + 1, stake: ladderStake(rules, i) }));
  return { rules, tracks, rows };
}
