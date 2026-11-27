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

/** The iPhone app's own scheme: ASWebAuthenticationSession returns only on it. */
const APP_RETURN = "shadowforum://me";

function finishApp(code: string) {
  return NextResponse.redirect(new URL(`${APP_RETURN}?whoop=${code === "connected" ? "ok" : code}`));
}

/**
 * Who started this flow. Web: the state cookie must match the signed-in user.
 * iPhone app: no cookie or session in the browser; the state row binds the user
 * and is deleted as it is read, so it works once.
 */
async function flowUser(req: NextRequest, state: string | null): Promise<{ userId: string; native: boolean } | null> {
  if (!state || !/^[A-Za-z0-9]{8}$/.test(state)) return null;
  const packed = unpackOAuthState(req.cookies.get(OAUTH_STATE_COOKIE)?.value);
  if (packed) {
    const user = await getSessionUser(await createClient());
    return user && packed.state === state && packed.userId === user.id ? { userId: user.id, native: false } : null;
  }
  const { data } = await createAdminClient()
    .from("whoop_oauth_states")
    .delete()
    .eq("state", state)
    .gt("expires_at", new Date().toISOString())
    .select("user_id")
    .maybeSingle();
  return data ? { userId: data.user_id, native: true } : null;
}

/** Exchange the WHOOP code server-side and store encrypted tokens. */
export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");
  const flow = await flowUser(req, state);
  if (!flow) return finish(req, "error");
  const user = { id: flow.userId };
  // Web flows end on /me; app flows end on the app's scheme.
  const done = (code: string) => (flow.native ? finishApp(code) : finish(req, code));
  if (isExternallySynced(user.id)) return done("external");

  const oauthError = req.nextUrl.searchParams.get("error");
  if (oauthError === "access_denied") return done("denied");
  if (oauthError) return done("error");

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return done("error");

  let creds;
  try {
    creds = credentialsFromEnv();
    tokenKeyFromEnv();
  } catch {
    return done("unconfigured");
  }

  try {
    const tokens = persistedTokens(await exchangeAuthorizationCode(code, creds));
    const profile = await fetchWhoopProfile(tokens.accessToken);
    const admin = createAdminClient();
    const saved = await saveConnection(admin, user.id, profile, tokens);
    if (saved.error) return done(saved.error.includes("already linked") ? "taken" : "error");

    try {
      await syncRecentDays(admin, user.id);
    } catch (err) {
      const message = (err instanceof Error ? err.message : "Initial sync failed").slice(0, 300);
      await admin
        .from("whoop_connections")
        .update({ last_error: message, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
    }
    return done("connected");
  } catch {
    return done("error");
  }
}
