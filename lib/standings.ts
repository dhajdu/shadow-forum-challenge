import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { CONTEST_START_DAY, dayOfContest } from "@/lib/contest";

export type Standing = {
  user_id: string;
  full_name: string;
  avg: number; // average ranked score
  days: number; // days with a score
  missed: number; // contest days so far with no data
};

/**
 * Average ranked WHOOP score per rider, ranked high→low.
 * Reads whoop_days + profiles (both readable by any authenticated member).
 */
export async function getStandings(
  supabase: SupabaseClient<Database>
): Promise<Standing[]> {
  const { data: rows } = await supabase.from("whoop_days").select("user_id, score, day");
  const { data: profs } = await supabase.from("profiles").select("id, full_name");

  const names = new Map<string, string>();
  for (const p of (profs ?? []) as { id: string; full_name: string }[]) {
    names.set(p.id, p.full_name || "Rider");
  }

  const today = new Date().toISOString().slice(0, 10);
  const elapsed = dayOfContest(); // contest days so far (0 before it starts)

  const agg = new Map<string, { sum: number; n: number; contestDays: Set<string> }>();
  for (const r of (rows ?? []) as { user_id: string; score: number | null; day: string }[]) {
    const cur = agg.get(r.user_id) ?? { sum: 0, n: 0, contestDays: new Set<string>() };
    if (r.score != null) {
      cur.sum += r.score;
      cur.n += 1;
    }
    if (r.day >= CONTEST_START_DAY && r.day <= today) cur.contestDays.add(r.day);
    agg.set(r.user_id, cur);
  }

  const standings: Standing[] = [];
  for (const [id, full_name] of names) {
    const a = agg.get(id);
    const present = a?.contestDays.size ?? 0;
    standings.push({
      user_id: id,
      full_name,
      avg: a && a.n > 0 ? Math.round((a.sum / a.n) * 10) / 10 : 0,
      days: a?.n ?? 0,
      missed: Math.max(0, elapsed - present),
    });
  }

  standings.sort((x, y) => y.avg - x.avg);
  return standings;
}
