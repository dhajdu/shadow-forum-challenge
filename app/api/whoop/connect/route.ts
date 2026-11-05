import { NextResponse, type NextRequest } from "next/server";
import { credentialsFromEnv, isExternallySynced } from "@/lib/whoop/config";
import { tokenKeyFromEnv } from "@/lib/whoop/crypto";
import { buildAuthorizeUrl, createOAuthState, OAUTH_STATE_COOKIE, packOAuthState } from "@/lib/whoop/oauth";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";

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
