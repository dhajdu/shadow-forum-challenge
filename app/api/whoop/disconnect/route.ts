import { NextResponse, type NextRequest } from "next/server";
import { requireMember } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { disconnectUser } from "@/lib/whoop/sync";

export const dynamic = "force-dynamic";

/** POST — revoke the caller's own WHOOP grant and delete the stored tokens (the app's twin of disconnectWhoop). */
export async function POST(req: NextRequest) {
  const gate = await requireMember(req);
  if (!gate.ok) return gate.res;
  await disconnectUser(createAdminClient(), gate.auth.user.id);
  return NextResponse.json({ ok: true });
}
