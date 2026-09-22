import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStandings } from "@/lib/standings";
import { isAuthorizedCron } from "@/lib/cron";

export const dynamic = "force-dynamic";

// The Steward — recompute standings and write today's snapshot.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, day, riders: data.length });
}
