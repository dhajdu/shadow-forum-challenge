import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { runCheckinFines } from "@/lib/agents";

export const dynamic = "force-dynamic";

// Missed check-in fines into the kitty (the weekly /api/cron/daily runs it too). Safe to re-run.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  try {
    return NextResponse.json({ ok: true, dry, ...(await runCheckinFines(createAdminClient(), { dry })) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
