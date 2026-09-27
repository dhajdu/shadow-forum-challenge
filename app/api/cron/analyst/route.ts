import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { runAnalyst } from "@/lib/analyst";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // one Claude call per rider, run in parallel

// The Analyst — weekly journal-vs-scores analysis (also runs in the Monday cron).
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await runAnalyst(createAdminClient())) });
}
