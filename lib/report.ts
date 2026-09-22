import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, GoalStatus } from "@/lib/database.types";
import { getStandings } from "@/lib/standings";
import { placementPenalty } from "@/lib/contest";

export type ReportRow = {
  user_id: string;
  name: string;
  avg: number;
  rank: number;
  delta: number | null; // rank change vs ~a month ago (+ = moved up)
  goalStatus: GoalStatus;
  owes: number; // placement penalty (M)
};

export type Report = {
  standings: ReportRow[];
  topMover: ReportRow | null;
  topFaller: ReportRow | null;
};

export async function buildReport(supabase: SupabaseClient<Database>): Promise<Report> {
  const standings = await getStandings(supabase);

  // public goal statuses
  const { data: goals } = await supabase.from("goals").select("user_id, current_status");
  const statusByUser = new Map<string, GoalStatus>();
  for (const g of (goals ?? []) as { user_id: string; current_status: GoalStatus }[]) {
    statusByUser.set(g.user_id, g.current_status);
  }

  // movement: compare against the oldest snapshot in the last ~35 days
  const since = new Date();
  since.setDate(since.getDate() - 35);
  const { data: snaps } = await supabase
    .from("standings_snapshots")
    .select("day, data")
    .gte("day", since.toISOString().slice(0, 10))
    .order("day", { ascending: true })
    .limit(1);

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
      owes: placementPenalty(i),
    };
  });

  const withDelta = rows.filter((r) => r.delta != null) as (ReportRow & { delta: number })[];
  const topMover = withDelta.length
    ? withDelta.reduce((a, b) => (b.delta > a.delta ? b : a))
    : null;
  const topFaller = withDelta.length
    ? withDelta.reduce((a, b) => (b.delta < a.delta ? b : a))
    : null;

  return { standings: rows, topMover, topFaller };
}
