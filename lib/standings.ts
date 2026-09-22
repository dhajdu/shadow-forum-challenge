import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type Standing = {
  user_id: string;
  full_name: string;
  avg: number; // average ranked score
  days: number; // days with a score
};

/**
 * Average ranked WHOOP score per rider, ranked high→low.
 * Reads whoop_days + profiles (both readable by any authenticated member).
 */
export async function getStandings(
  supabase: SupabaseClient<Database>
): Promise<Standing[]> {
  const { data: rows } = await supabase.from("whoop_days").select("user_id, score");
  const { data: profs } = await supabase.from("profiles").select("id, full_name");

  const names = new Map<string, string>();
  for (const p of (profs ?? []) as { id: string; full_name: string }[]) {
    names.set(p.id, p.full_name || "Rider");
  }

  const agg = new Map<string, { sum: number; n: number }>();
  for (const r of (rows ?? []) as { user_id: string; score: number | null }[]) {
    if (r.score == null) continue;
    const cur = agg.get(r.user_id) ?? { sum: 0, n: 0 };
    cur.sum += r.score;
    cur.n += 1;
    agg.set(r.user_id, cur);
  }

  const standings: Standing[] = [];
  // include every profile, even with no data yet (avg 0)
  for (const [id, full_name] of names) {
    const a = agg.get(id);
    standings.push({
      user_id: id,
      full_name,
      avg: a && a.n > 0 ? Math.round((a.sum / a.n) * 10) / 10 : 0,
      days: a?.n ?? 0,
    });
  }

  standings.sort((x, y) => y.avg - x.avg);
  return standings;
}
