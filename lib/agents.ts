// Core agent logic, shared by the individual cron routes and the daily aggregator.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getStandings } from "@/lib/standings";
import { placementPenalty, CONTEST_START, CONTEST_END } from "@/lib/contest";
import { sendEmail } from "@/lib/notify";
import { selectAll } from "@/lib/supabase/selectAll";
import { loadAccess, seasonAudience } from "@/lib/access";
import { sendPush } from "@/lib/push";

type Admin = SupabaseClient<Database>;

// ── The Steward: snapshot this week's race placing (runs Monday) ──
export async function runSteward(admin: Admin) {
  const standings = await getStandings(admin);
  const day = new Date().toISOString().slice(0, 10);
  const data = standings.map((s, i) => ({
    user_id: s.user_id,
    full_name: s.full_name,
    avg: s.avg,
    days: s.days,
    missed: s.missed,
    rank: i + 1,
  }));
  const { error } = await admin
    .from("standings_snapshots")
    .upsert({ day, data }, { onConflict: "day" });
  if (error) throw new Error(error.message);
  return { day, riders: data.length };
}

// ── The Whip: nudge riders with stale data (only sends during the contest) ──
// Only riders in today's season: members who joined after it started, or left,
// get no contest mail.
const STALE_DAYS = 7; // riders upload weekly
export async function runWhip(admin: Admin, opts: { dry: boolean }) {
  const { members, current } = await loadAccess(admin);
  const profs = seasonAudience(members, current);
  const rows = await selectAll<{ user_id: string; day: string }>((from, to) =>
    admin.from("whoop_days").select("user_id, day").order("day").order("user_id").range(from, to)
  );

  const latest = new Map<string, string>();
  for (const r of rows) {
    const cur = latest.get(r.user_id);
    if (!cur || r.day > cur) latest.set(r.user_id, r.day);
  }

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const stale = profs
    .filter((p) => {
      const l = latest.get(p.id);
      return !l || l < cutoffStr;
    })
    .map((p) => ({ id: p.id, name: p.full_name, email: p.email, lastData: latest.get(p.id) ?? null }));

  const contestActive = now >= CONTEST_START && now <= CONTEST_END;
  let nudged = 0;
  if (!opts.dry && contestActive) {
    for (const s of stale) {
      if (!s.email) continue;
      const res = await sendEmail({
        to: s.email,
        subject: "The Whip: your WHOOP data has gone quiet",
        html: `<p>${s.name || "Rider"}, your data is stale${
          s.lastData ? ` (last seen ${s.lastData})` : ""
        }. Upload your WHOOP export this week so your days count — and keep the strap on: days it doesn't record are logged as missed. 🏃</p>`,
      });
      if (res.ok) nudged++;
    }
    await sendPush(admin, stale.map((s) => s.id), { kind: "whip_nudge" }, members).catch(() => null);
  }
  return { contestActive, staleCount: stale.length, stale, nudged };
}

// ── The Bookkeeper: book the kitty charges ──
// Nothing is charged until the contest ends — until then the kitty is shown live
// from race position. At the end it books WHOOP race placement (contest average);
// business-goal penalties are settled separately.
const PERIOD = "Q4-2026";
const SEASON_SLUG = "2026-q4";
export async function runBookkeeper(admin: Admin) {
  if (new Date() <= CONTEST_END) return { period: PERIOD, skipped: "contest still running", entries: 0, kitty: 0 };

  const { data: season, error: seasonErr } = await admin.from("seasons").select("id").eq("slug", SEASON_SLUG).single();
  if (seasonErr || !season) throw new Error(seasonErr?.message ?? `season ${SEASON_SLUG} missing`);

  // race_standings lists only the season's riders, so later joiners are never charged
  const standings = await getStandings(admin);

  const rows = standings
    .map((s, i) => ({
      user_id: s.user_id,
      kind: "placement" as const,
      amount_m: placementPenalty(i),
      reason: `Placement #${i + 1}`,
      period: PERIOD,
      season_id: season.id,
    }))
    .filter((r) => r.amount_m > 0);

  await admin.from("penalties").delete().eq("season_id", season.id);
  if (rows.length > 0) {
    const { error } = await admin.from("penalties").insert(rows);
    if (error) throw new Error(error.message);
  }
  return { period: PERIOD, entries: rows.length, kitty: rows.reduce((a, b) => a + b.amount_m, 0) };
}
