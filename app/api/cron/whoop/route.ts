import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { syncAllConnected } from "@/lib/whoop/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily backup: re-sync the last ~10 days for every connected member. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const report = await syncAllConnected(createAdminClient());
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
