import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Landing point for Supabase email links (password reset). Handles both the
// PKCE `code` from the default template and a `token_hash` template, which
// also works when the link is opened in a different browser.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/race";
  // only allow same-site relative paths
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/race";

  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Missing token") };

  if (error) return NextResponse.redirect(`${origin}/?reset=expired`);
  return NextResponse.redirect(`${origin}${dest}`);
}
