import { NextResponse, type NextRequest } from "next/server";
import { getRequestUser } from "@/lib/supabase/request";
import { ingestUpload } from "@/lib/whoop/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST { uploadId } — parse a WHOOP export the rider already uploaded to the
 * `whoop` bucket (and recorded in `uploads`). Same code path as the web upload.
 */
export async function POST(req: NextRequest) {
  const auth = await getRequestUser(req);
  if (!auth) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { uploadId?: unknown };
  if (typeof body.uploadId !== "string" || body.uploadId === "") {
    return NextResponse.json({ error: "Missing uploadId." }, { status: 400 });
  }

  const res = await ingestUpload(auth.supabase, auth.user.id, body.uploadId);
  return NextResponse.json(res, { status: res.error ? 422 : 200 });
}
