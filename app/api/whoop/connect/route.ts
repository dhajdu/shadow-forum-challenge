import { NextResponse, type NextRequest } from "next/server";
import { credentialsFromEnv, isExternallySynced } from "@/lib/whoop/config";
import { tokenKeyFromEnv } from "@/lib/whoop/crypto";
import { buildAuthorizeUrl, createOAuthState, OAUTH_STATE_COOKIE, packOAuthState } from "@/lib/whoop/oauth";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";

export const dynamic = "force-dynamic";

function me(req: NextRequest, code: string) {
  const url = req.nextUrl.clone();
  url.pathname = "/me";
  url.search = `?whoop=${code}`;
  return NextResponse.redirect(url);
}

/** Start WHOOP OAuth. The state cookie is checked again on the callback. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return me(req, "error");
  if (isExternallySynced(user.id)) return me(req, "external");

  try {
    credentialsFromEnv();
    tokenKeyFromEnv();
  } catch {
    return me(req, "unconfigured");
  }

  const state = createOAuthState();
  const res = NextResponse.redirect(buildAuthorizeUrl(credentialsFromEnv(), state));
  res.cookies.set(OAUTH_STATE_COOKIE, packOAuthState(state, user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/whoop",
    maxAge: 60 * 10,
  });
  return res;
}

/**
 * iPhone app: POST with Authorization: Bearer → { url } to open in the system
 * browser. There is no cookie, so the state is bound to the member in
 * whoop_oauth_states (single use, 10 minutes). The callback finishes on /me,
 * a Universal Link back into the app.
 */
export async function POST(req: NextRequest) {
  const gate = await requireMember(req);
  if (!gate.ok) return gate.res;
  const userId = gate.auth.user.id;
  if (isExternallySynced(userId)) return NextResponse.json({ error: "external" }, { status: 409 });

  let creds;
  try {
    creds = credentialsFromEnv();
    tokenKeyFromEnv();
  } catch {
    return NextResponse.json({ error: "unconfigured" }, { status: 503 });
  }

  const admin = createAdminClient();
  await admin.from("whoop_oauth_states").delete().lt("expires_at", new Date().toISOString());
  const state = createOAuthState();
  const { error } = await admin.from("whoop_oauth_states").insert({ state, user_id: userId });
  if (error) return NextResponse.json({ error: "Could not start WHOOP sign-in." }, { status: 500 });
  return NextResponse.json({ url: buildAuthorizeUrl(creds, state) });
}
