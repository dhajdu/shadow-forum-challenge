import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { CONTEST_START_DAY } from "@/lib/contest";

export type Standing = {
  user_id: string;
  full_name: string;
  avg: number; // average blended score over the window
  days: number; // days with a score in the window
  missed: number; // contest days so far with no data
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

  // per rider: scores in the window + the set of every day they have a row for
  const agg = new Map<string, { sum: number; n: number; days: Set<string>; first?: string }>();
  for (const r of rows) {
    const cur = agg.get(r.user_id) ?? { sum: 0, n: 0, days: new Set<string>() };
    const inWindow = !opts.sinceDay || r.day >= opts.sinceDay;
    if (r.score != null && inWindow) {
      cur.sum += r.score;
      cur.n += 1;
    }
    cur.days.add(r.day);
    if (!cur.first || r.day < cur.first) cur.first = r.day;
    agg.set(r.user_id, cur);
  }

  const out: Standing[] = [];
  for (const [id, full_name] of names) {
    const a = agg.get(id);
    // window: contest → from the fixed start; all-time → from the rider's first day.
    const start = opts.sinceDay ?? a?.first;
    let missed = 0;
    if (start && start <= today) {
      let present = 0;
      for (const d of a?.days ?? []) if (d >= start && d <= today) present++;
      missed = Math.max(0, spanDays(start, today) - present);
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
