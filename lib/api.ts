// One gate for member-facing API routes (web session cookie or iPhone Bearer).
// Order: app build (MOBILE_MIN_BUILD) → signed in → active forum member.
import { NextResponse } from "next/server";
import { getRequestUser, type AuthedRequest } from "@/lib/supabase/request";
import { isActiveCaller } from "@/lib/access";

/** The iPhone app sends its build number on every request. */
export const APP_BUILD_HEADER = "x-app-build";

export function minMobileBuild(): number | null {
  const v = Number(process.env.MOBILE_MIN_BUILD);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * 426 when a native-app request comes from a build older than MOBILE_MIN_BUILD.
 * Only Bearer requests are native; the website never sends the header.
 */
export function outdatedApp(req: Request): NextResponse | null {
  const min = minMobileBuild();
  if (min == null || !/^Bearer\s/i.test(req.headers.get("authorization") ?? "")) return null;
  const build = Number(req.headers.get(APP_BUILD_HEADER) ?? 0);
  if (Number.isFinite(build) && build >= min) return null;
  return NextResponse.json({ error: "update_required", min_build: min }, { status: 426 });
}

export type Gate = { ok: true; auth: AuthedRequest } | { ok: false; res: NextResponse };

export async function requireMember(req: Request): Promise<Gate> {
  const old = outdatedApp(req);
  if (old) return { ok: false, res: old };
  const auth = await getRequestUser(req);
  if (!auth) return { ok: false, res: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  if (!(await isActiveCaller(auth.supabase, auth.user.id))) {
    return { ok: false, res: NextResponse.json({ error: "No forum access." }, { status: 403 }) };
  }
  return { ok: true, auth };
}
