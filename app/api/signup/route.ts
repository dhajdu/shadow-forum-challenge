import { NextResponse, type NextRequest } from "next/server";
import { TOO_MANY, clientIp, createRider } from "@/lib/signup";

export const dynamic = "force-dynamic";

/**
 * POST { code, name, email, password } — gated sign-up for native apps. Creates the
 * confirmed account; the app then signs in with Supabase Auth directly.
 */
export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const error = await createRider({
    code: str(b.code),
    name: str(b.name),
    email: str(b.email),
    password: str(b.password),
    ip: clientIp(req.headers),
  });
  return NextResponse.json({ error }, { status: error === TOO_MANY ? 429 : error ? 400 : 200 });
}
