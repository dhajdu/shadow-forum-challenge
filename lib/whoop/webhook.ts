import { createHmac, timingSafeEqual } from "crypto";

/** Reject deliveries older than this. WHOOP retries for about an hour, so five minutes is enough to stop replays. */
export const WEBHOOK_MAX_SKEW_MS = 5 * 60 * 1000;

export type WhoopEvent = {
  user_id: number;
  id: string | number;
  type: string;
  trace_id?: string;
};

/**
 * WHOOP: base64(HMAC-SHA256(timestamp_header + raw_body, client_secret)).
 * Timestamp is milliseconds since epoch, sent as `X-WHOOP-Signature-Timestamp`.
 */
export function whoopWebhookSignature(timestamp: string, rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
}

export function verifyWhoopWebhook(args: {
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  secret: string | null;
  now?: number;
  maxSkewMs?: number;
}): boolean {
  if (!args.secret || !args.timestamp || !args.signature) return false;
  const stamped = Number(args.timestamp);
  if (!Number.isFinite(stamped)) return false;
  const now = args.now ?? Date.now();
  if (Math.abs(now - stamped) > (args.maxSkewMs ?? WEBHOOK_MAX_SKEW_MS)) return false;

  const expected = createHmac("sha256", args.secret).update(args.timestamp + args.rawBody).digest();
  const got = Buffer.from(args.signature, "base64");
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}

export function parseWhoopEvent(raw: string): WhoopEvent | null {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.type !== "string") return null;
  if (typeof record.id !== "string" && typeof record.id !== "number") return null;
  if (typeof record.user_id !== "number" && typeof record.user_id !== "string") return null;
  const userId = Number(record.user_id);
  if (!Number.isFinite(userId)) return null;
  return {
    user_id: userId,
    id: record.id,
    type: record.type,
    trace_id: typeof record.trace_id === "string" ? record.trace_id : undefined,
  };
}
