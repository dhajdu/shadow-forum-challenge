import { NextResponse, type NextRequest } from "next/server";
import { requireMember } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const EXPO_TOKEN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

/**
 * POST { expo_token, platform: "ios" | "android", app_version? } — register this
 * device for the signed-in member. A token that last belonged to someone else (a
 * shared phone) moves to the caller: the device itself proves it holds the token.
 */
export async function POST(req: NextRequest) {
  const gate = await requireMember(req);
  if (!gate.ok) return gate.res;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = typeof b.expo_token === "string" ? b.expo_token.trim() : "";
  const platform = b.platform === "android" ? "android" : b.platform === "ios" ? "ios" : null;
  if (!EXPO_TOKEN.test(token) || !platform) {
    return NextResponse.json({ error: "Send expo_token and platform ('ios' or 'android')." }, { status: 400 });
  }
  const appVersion = typeof b.app_version === "string" ? b.app_version.slice(0, 40) : null;

  // Service role only to reassign a token across users; scoped to the caller's id.
  const { error } = await createAdminClient()
    .from("push_devices")
    .upsert(
      { user_id: gate.auth.user.id, platform, expo_token: token, app_version: appVersion, last_seen_at: new Date().toISOString(), revoked_at: null },
      { onConflict: "expo_token" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE { expo_token } — sign-out on this device: stop pushes to it. */
export async function DELETE(req: NextRequest) {
  const gate = await requireMember(req);
  if (!gate.ok) return gate.res;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = typeof b.expo_token === "string" ? b.expo_token.trim() : "";
  if (!token) return NextResponse.json({ error: "Send expo_token." }, { status: 400 });
  const { error } = await gate.auth.supabase
    .from("push_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("expo_token", token)
    .eq("user_id", gate.auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
