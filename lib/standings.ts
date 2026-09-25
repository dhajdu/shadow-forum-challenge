import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type Standing = {
  user_id: string;
  full_name: string;
  avg: number; // average blended score over the window
  days: number; // days with a score in the window
  missed: number; // contest days WHOOP didn't record (gaps up to the latest upload)
};

type ViewRow = Database["public"]["Views"]["race_standings"]["Row"];

// One row per rider from the race_standings view (computed from whoop_days on read).
async function fetchView(supabase: SupabaseClient<Database>): Promise<ViewRow[]> {
  const { data, error } = await supabase.from("race_standings").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as ViewRow[];
}

const contestOf = (r: ViewRow): Standing => ({
  user_id: r.user_id,
  full_name: r.full_name,
  avg: r.contest_avg,
  days: r.contest_days,
  missed: r.contest_missed,
});

const allTimeOf = (r: ViewRow): Standing => ({
  user_id: r.user_id,
  full_name: r.full_name,
  avg: r.all_avg,
  days: r.all_days,
  missed: r.contest_missed,
});

const byAvg = (x: Standing, y: Standing) => y.avg - x.avg;

/** The race placing (contest window) — used by rider pages, reports, agents. */
export async function getStandings(supabase: SupabaseClient<Database>): Promise<Standing[]> {
  return (await fetchView(supabase)).map(contestOf).sort(byAvg);
}

/** Both rankings for the race board: contest window (from start) and all-time. */
export async function getRaceStandings(
  supabase: SupabaseClient<Database>
): Promise<{ contest: Standing[]; all: Standing[] }> {
  const rows = await fetchView(supabase);
  return {
    contest: rows.map(contestOf).sort(byAvg),
    all: rows.map(allTimeOf).sort(byAvg),
  };
}
