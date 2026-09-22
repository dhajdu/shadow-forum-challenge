// Core agent logic, shared by the individual cron routes and the daily aggregator.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, GoalStatus } from "@/lib/database.types";
import { getStandings } from "@/lib/standings";
import {
  placementPenalty,
  MISSED_GOAL_PENALTY,
  COACH_SHARE_PENALTY,
  CONTEST_START,
  CONTEST_END,
} from "@/lib/contest";
import { sendEmail } from "@/lib/notify";

type Admin = SupabaseClient<Database>;

// ── The Steward: recompute standings, write today's snapshot ──
export async function runSteward(admin: Admin) {
  const standings = await getStandings(admin);
  const day = new Date().toISOString().slice(0, 10);
  const data = standings.map((s, i) => ({
    user_id: s.user_id,
    full_name: s.full_name,
    avg: s.avg,
    rank: i + 1,
  }));
  const { error } = await admin
    .from("standings_snapshots")
    .upsert({ day, data }, { onConflict: "day" });
  if (error) throw new Error(error.message);
  return { day, riders: data.length };
}

// ── The Whip: nudge riders with stale data (only sends during the contest) ──
const STALE_DAYS = 2;
export async function runWhip(admin: Admin, opts: { dry: boolean }) {
  const { data: profs } = await admin.from("profiles").select("id, full_name, email");
  const { data: rows } = await admin.from("whoop_days").select("user_id, day");

  const latest = new Map<string, string>();
  for (const r of (rows ?? []) as { user_id: string; day: string }[]) {
    const cur = latest.get(r.user_id);
    if (!cur || r.day > cur) latest.set(r.user_id, r.day);
  }

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const stale = ((profs ?? []) as { id: string; full_name: string; email: string | null }[])
    .filter((p) => {
      const l = latest.get(p.id);
      return !l || l < cutoffStr;
    })
    .map((p) => ({ name: p.full_name, email: p.email, lastData: latest.get(p.id) ?? null }));

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
        }. Missing days count as your lowest score — upload before you slide down the shadow. 🏃</p>`,
      });
      if (res.ok) nudged++;
    }
  }
  return { contestActive, staleCount: stale.length, stale, nudged };
}

// ── The Bookkeeper: recompute the kitty ledger ──
const PERIOD = "Q4-2026";
export async function runBookkeeper(admin: Admin) {
  const standings = await getStandings(admin);
  const { data: goals } = await admin.from("goals").select("user_id, coach_id, current_status");

  type Row = {
    user_id: string;
    kind: "placement" | "missed_goal" | "coach_share";
    amount_m: number;
    reason: string;
    period: string;
  };
  const rows: Row[] = [];

  standings.forEach((s, i) => {
    const owes = placementPenalty(i);
    if (owes > 0)
      rows.push({ user_id: s.user_id, kind: "placement", amount_m: owes, reason: `Placement #${i + 1}`, period: PERIOD });
  });

  for (const g of (goals ?? []) as { user_id: string; coach_id: string | null; current_status: GoalStatus }[]) {
    if (g.current_status === "hit") continue;
    rows.push({ user_id: g.user_id, kind: "missed_goal", amount_m: MISSED_GOAL_PENALTY, reason: "Missed business goal", period: PERIOD });
    if (g.coach_id)
      rows.push({ user_id: g.coach_id, kind: "coach_share", amount_m: COACH_SHARE_PENALTY, reason: "Coach share (goal missed)", period: PERIOD });
  }

  await admin.from("penalties").delete().eq("period", PERIOD);
  if (rows.length > 0) {
    const { error } = await admin.from("penalties").insert(rows);
    if (error) throw new Error(error.message);
  }
  return { period: PERIOD, entries: rows.length, kitty: rows.reduce((a, b) => a + b.amount_m, 0) };
}
