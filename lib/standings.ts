import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { CONTEST_START_DAY } from "@/lib/contest";

export type Standing = {
  user_id: string;
  full_name: string;
  avg: number; // average blended score over the window
  days: number; // days with a score in the window
  missed: number; // contest days WHOOP didn't record (gaps up to the latest upload)
};

type Row = { user_id: string; score: number | null; day: string };

const spanDays = (start: string, end: string) =>
  start <= end ? Math.floor((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1 : 0;

function build(
  rows: Row[],
  names: Map<string, string>,
  opts: { sinceDay?: string }
): Standing[] {
  const today = new Date().toISOString().slice(0, 10);

  // per rider: scores in the window + the set of days WHOOP recorded a score + latest uploaded day
  const agg = new Map<string, { sum: number; n: number; days: Set<string>; last?: string }>();
  for (const r of rows) {
    const cur = agg.get(r.user_id) ?? { sum: 0, n: 0, days: new Set<string>() };
    const inWindow = !opts.sinceDay || r.day >= opts.sinceDay;
    if (r.score != null && inWindow) {
      cur.sum += r.score;
      cur.n += 1;
    }
    if (r.score != null) cur.days.add(r.day);
    if (!cur.last || r.day > cur.last) cur.last = r.day;
    agg.set(r.user_id, cur);
  }

  const out: Standing[] = [];
  for (const [id, full_name] of names) {
    const a = agg.get(id);
    // "missed" = contest days the WHOOP didn't record: gaps (no row, or no score)
    // between the contest start and the rider's latest uploaded day. Days not yet
    // uploaded don't count. 0 until the contest begins.
    let missed = 0;
    const end = a?.last && a.last < today ? a.last : today;
    if (a?.last && CONTEST_START_DAY <= a.last) {
      let present = 0;
      for (const d of a.days) if (d >= CONTEST_START_DAY && d <= end) present++;
      missed = Math.max(0, spanDays(CONTEST_START_DAY, end) - present);
    }
    out.push({
      user_id: id,
      full_name,
      avg: a && a.n > 0 ? Math.round((a.sum / a.n) * 10) / 10 : 0,
      days: a?.n ?? 0,
      missed,
    });
  }
  out.sort((x, y) => y.avg - x.avg);
  return out;
}

async function fetchAll(supabase: SupabaseClient<Database>) {
  const { data: rows } = await supabase.from("whoop_days").select("user_id, score, day");
  const { data: profs } = await supabase.from("profiles").select("id, full_name");
  const names = new Map<string, string>();
  for (const p of (profs ?? []) as { id: string; full_name: string }[]) {
    names.set(p.id, p.full_name || "Rider");
  }
  return { rows: (rows ?? []) as Row[], names };
}

/** All-time standings (used by dashboards, rider pages, reports, agents). */
export async function getStandings(supabase: SupabaseClient<Database>): Promise<Standing[]> {
  const { rows, names } = await fetchAll(supabase);
  return build(rows, names, {});
}

/** Both rankings for the race board: contest window (from start) and all-time. */
export async function getRaceStandings(
  supabase: SupabaseClient<Database>
): Promise<{ contest: Standing[]; all: Standing[] }> {
  const { rows, names } = await fetchAll(supabase);
  return {
    contest: build(rows, names, { sinceDay: CONTEST_START_DAY }),
    all: build(rows, names, {}),
  };
}
