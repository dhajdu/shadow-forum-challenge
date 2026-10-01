import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { USER_ID_HEADER, USER_EMAIL_HEADER } from "@/lib/supabase/session";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// Protected areas — unauthenticated visitors get bounced to the landing page.
const PROTECTED = ["/dashboard", "/race", "/me", "/profile", "/welcome", "/rider", "/report", "/rules", "/reset-password"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the session cookie; also tells us if the user is signed in.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Hand the verified user to pages/routes so they don't re-check with Supabase.
  // Always overwrite, so a client can't send these headers itself.
  const headers = new Headers(request.headers);
  headers.delete(USER_ID_HEADER);
  headers.delete(USER_EMAIL_HEADER);
  if (user) {
    headers.set(USER_ID_HEADER, user.id);
    if (user.email) headers.set(USER_EMAIL_HEADER, user.email);
  }
  const forwarded = NextResponse.next({ request: { headers } });
  response.cookies.getAll().forEach((c) => forwarded.cookies.set(c));
  return forwarded;
}
