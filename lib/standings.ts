import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type Standing = {
  user_id: string;
  full_name: string;
  avg: number; // average blended score over the window
  days: number; // days with a score in the window
  missed: number; // contest days WHOOP didn't record (gaps up to the latest upload)
  stale: boolean; // no new WHOOP data in over STALE_DAYS days
};

// Riders are asked to upload weekly — flag anyone whose newest data is older than this.
export const STALE_DAYS = 7;

const isStale = (lastDataDay: string | null) => {
  if (!lastDataDay) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);
  return lastDataDay < cutoff.toISOString().slice(0, 10);
};

type ViewRow = Database["public"]["Views"]["season_standings"]["Row"];

// One row per rider (computed from whoop_days on read). With a season id, that
// season's board; without, today's season (race_standings).
async function fetchView(supabase: SupabaseClient<Database>, seasonId?: string): Promise<ViewRow[]> {
  const { data, error } = seasonId
    ? await supabase.from("season_standings").select("*").eq("season_id", seasonId)
    : await supabase.from("race_standings").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as ViewRow[];
}

// The race uses contest days only (from the contest start).
const contestOf = (r: ViewRow): Standing => ({
  user_id: r.user_id,
  full_name: r.full_name,
  avg: r.contest_avg,
  days: r.contest_days,
  missed: r.contest_missed,
  stale: isStale(r.last_data_day),
});

// Highest average first; riders with no scored days yet go last, by name.
const byAvg = (x: Standing, y: Standing) =>
  Number(y.days > 0) - Number(x.days > 0) || y.avg - x.avg || x.full_name.localeCompare(y.full_name);

/**
 * The race placing: average daily score over the season's days. Pass a season id
 * for a given season; omit it for the season running today. Used by the race,
 * rider pages, reports and agents.
 */
export async function getStandings(supabase: SupabaseClient<Database>, seasonId?: string): Promise<Standing[]> {
  return (await fetchView(supabase, seasonId)).map(contestOf).sort(byAvg);
}
