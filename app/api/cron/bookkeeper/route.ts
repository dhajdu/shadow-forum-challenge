import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { getStandings } from "@/lib/standings";
import { placementPenalty, MISSED_GOAL_PENALTY, COACH_SHARE_PENALTY } from "@/lib/contest";
import type { GoalStatus } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const PERIOD = "Q4-2026";

// The Bookkeeper — recompute the kitty ledger (placement + missed-goal penalties).
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const standings = await getStandings(admin);
  const { data: goals } = await admin
    .from("goals")
    .select("user_id, coach_id, current_status");

  type Row = { user_id: string; kind: "placement" | "missed_goal" | "coach_share"; amount_m: number; reason: string; period: string };
  const rows: Row[] = [];

  // placement penalties (provisional — if the race ended today)
  standings.forEach((s, i) => {
    const owes = placementPenalty(i);
    if (owes > 0) {
      rows.push({ user_id: s.user_id, kind: "placement", amount_m: owes, reason: `Placement #${i + 1}`, period: PERIOD });
    }
  });

  // missed business goals → rider 5M + coach 5M
  for (const g of (goals ?? []) as { user_id: string; coach_id: string | null; current_status: GoalStatus }[]) {
    if (g.current_status === "hit") continue;
    rows.push({ user_id: g.user_id, kind: "missed_goal", amount_m: MISSED_GOAL_PENALTY, reason: "Missed business goal", period: PERIOD });
    if (g.coach_id) {
      rows.push({ user_id: g.coach_id, kind: "coach_share", amount_m: COACH_SHARE_PENALTY, reason: "Coach share (goal missed)", period: PERIOD });
    }
  }

  // recompute: clear this period, then re-insert
  await admin.from("penalties").delete().eq("period", PERIOD);
  if (rows.length > 0) {
    const { error } = await admin.from("penalties").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const kitty = rows.reduce((a, b) => a + b.amount_m, 0);
  return NextResponse.json({ ok: true, period: PERIOD, entries: rows.length, kitty });
}
