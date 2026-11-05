import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { credentialsFromEnv, isExternallySynced } from "@/lib/whoop/config";
import { tokenKeyFromEnv } from "@/lib/whoop/crypto";
import { OAUTH_STATE_COOKIE, exchangeAuthorizationCode, persistedTokens, unpackOAuthState } from "@/lib/whoop/oauth";
import { fetchWhoopProfile, saveConnection, syncRecentDays } from "@/lib/whoop/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function finish(req: NextRequest, code: string) {
  const url = req.nextUrl.clone();
  url.pathname = "/me";
  url.search = `?whoop=${code}`;
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/whoop",
    maxAge: 0,
  });
  return res;
}

/** Exchange the WHOOP code server-side and store encrypted tokens. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return finish(req, "error");
  if (isExternallySynced(user.id)) return finish(req, "external");

  const oauthError = req.nextUrl.searchParams.get("error");
  if (oauthError === "access_denied") return finish(req, "denied");
  if (oauthError) return finish(req, "error");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const packed = unpackOAuthState(req.cookies.get(OAUTH_STATE_COOKIE)?.value);
  if (!code || !state || !packed || packed.state !== state || packed.userId !== user.id) {
    return finish(req, "error");
  }

  let creds;
  try {
    creds = credentialsFromEnv();
    tokenKeyFromEnv();
  } catch {
    return finish(req, "unconfigured");
  }

  try {
    const tokens = persistedTokens(await exchangeAuthorizationCode(code, creds));
    const profile = await fetchWhoopProfile(tokens.accessToken);
    const admin = createAdminClient();
    const saved = await saveConnection(admin, user.id, profile, tokens);
    if (saved.error) return finish(req, saved.error.includes("already linked") ? "taken" : "error");

    try {
      await syncRecentDays(admin, user.id);
    } catch (err) {
      const message = (err instanceof Error ? err.message : "Initial sync failed").slice(0, 300);
      await admin
        .from("whoop_connections")
        .update({ last_error: message, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
    }
    return finish(req, "connected");
  } catch {
    return finish(req, "error");
  }
}
