import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { runSteward, runWhip, runBookkeeper } from "@/lib/agents";

export const dynamic = "force-dynamic";

// Daily aggregator — runs the Steward, Whip, and Bookkeeper in one cron
// (keeps us within the platform's cron-job limit).
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const admin = createAdminClient();

  const steward = await runSteward(admin);
  const whip = await runWhip(admin, { dry });
  const bookkeeper = await runBookkeeper(admin);

  return NextResponse.json({ ok: true, steward, whip, bookkeeper });
}
