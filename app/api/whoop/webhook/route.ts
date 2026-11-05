import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { webhookSigningSecret } from "@/lib/whoop/config";
import { handleWhoopEvent } from "@/lib/whoop/sync";
import { parseWhoopEvent, verifyWhoopWebhook } from "@/lib/whoop/webhook";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * WHOOP v2 webhooks. Signature is checked before the body is trusted.
 * Processing is fast enough for one member to do inline; a 500 makes WHOOP retry.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const ok = verifyWhoopWebhook({
    timestamp: req.headers.get("x-whoop-signature-timestamp"),
    signature: req.headers.get("x-whoop-signature"),
    rawBody: raw,
    secret: webhookSigningSecret(),
  });
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  const event = parseWhoopEvent(raw);
  if (!event) return NextResponse.json({ error: "invalid event" }, { status: 400 });

  try {
    const outcome = await handleWhoopEvent(createAdminClient(), event);
    return NextResponse.json({ ok: true, outcome });
  } catch {
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}
