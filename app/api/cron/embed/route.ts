import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { embeddingsConfigured } from "@/lib/embed";
import { reindexStale } from "@/lib/chunks";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Rebuild the agenda search index for meetings whose docs changed. Run after a Lark import. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!embeddingsConfigured()) return NextResponse.json({ ok: true, skipped: "VOYAGE_API_KEY not set" });
  try {
    return NextResponse.json({ ok: true, ...(await reindexStale(createAdminClient())) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
