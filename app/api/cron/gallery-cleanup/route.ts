import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { cleanupGallery } from "@/lib/gallery";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Nightly: remove Gallery rows whose files never arrived and files whose row is gone. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await cleanupGallery(createAdminClient())) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
