import type { NextRequest } from "next/server";

// Vercel Cron adds `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
// Allow manual runs with the same bearer for testing.
export function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
