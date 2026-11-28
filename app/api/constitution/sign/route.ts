import { NextResponse, type NextRequest } from "next/server";
import { requireMember } from "@/lib/api";
import { consentText, getConstitution, sha256Hex } from "@/app/_data/constitution";

export const dynamic = "force-dynamic";

/**
 * POST { typed_name, sha256 } — the iPhone app's twin of the signConstitution server action.
 * Runs on the member's own session (RLS); keeps IP and user agent as evidence, like the website.
 */
export async function POST(req: NextRequest) {
  const gate = await requireMember(req);
  if (!gate.ok) return gate.res;
  const b = (await req.json().catch(() => ({}))) as { typed_name?: unknown; sha256?: unknown };
  const typed = String(b.typed_name ?? "").trim().replace(/\s+/g, " ");
  if (typed.length < 2) return NextResponse.json({ error: "Type your full name to sign." }, { status: 400 });

  const db = gate.auth.supabase;
  const { current } = await getConstitution(db);
  if (!current) return NextResponse.json({ error: "There is no Constitution to sign yet." }, { status: 404 });
  const shown = String(b.sha256 ?? "");
  if (shown !== current.sha256) return NextResponse.json({ error: "The Constitution changed while you had it open. Reload and read the new version." }, { status: 409 });
  if (sha256Hex(current.body_md) !== current.sha256) return NextResponse.json({ error: "The stored Constitution does not match its fingerprint. Ask Dave to republish it." }, { status: 500 });

  const { error } = await db.from("constitution_signatures").insert({
    version_id: current.id,
    typed_name: typed.slice(0, 120),
    consent: consentText(current.version),
    sha256_shown: shown,
    ip: (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "").trim().slice(0, 100) || null,
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 500) || null,
  });
  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "You have already signed this version." : "Could not save your signature. Try again." }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json({ ok: true, version: current.version });
}
