import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { runWhip } from "@/lib/agents";

export const dynamic = "force-dynamic";

// The Whip — nudge riders whose WHOOP data has gone stale.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const result = await runWhip(createAdminClient(), { dry });
  return NextResponse.json({
    ok: true,
    dry,
    ...result,
    stale: result.stale.map((s) => ({ name: s.name, lastData: s.lastData })),
  });
}
