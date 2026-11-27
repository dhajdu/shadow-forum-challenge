import { NextResponse, type NextRequest } from "next/server";
import { requireMember } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Admin "Members and access". The caller must be an active admin (checked on their
// own session); only then does the service role read auth users or send invites.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = (v: unknown) => (typeof v === "string" && DAY.test(v) ? v : null);
const today = () => new Date().toISOString().slice(0, 10);

async function requireAdmin(req: NextRequest) {
  const gate = await requireMember(req);
  if (!gate.ok) return gate;
  const { data } = await gate.auth.supabase.rpc("is_forum_admin");
  if (!data) return { ok: false as const, res: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  return gate;
}

/** GET — every member with email, join and leave dates, flags and status (active | invited | left | no_date). */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const admin = createAdminClient();
  const [{ data: profiles, error }, users] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, forum_joined_on, forum_left_on, is_founding, is_admin, last_seen_at").order("full_name"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const signedIn = new Map((users.data?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));
  const members = (profiles ?? []).map((p) => ({
    ...p,
    status:
      p.forum_left_on && p.forum_left_on <= today()
        ? "left"
        : !signedIn.get(p.id)
          ? "invited"
          : !p.forum_joined_on && !p.is_founding
            ? "no_date"
            : "active",
  }));
  return NextResponse.json({ members });
}

/** POST { email, full_name, forum_joined_on? } — invite by email; the join date may be set later. */
export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const fullName = typeof b.full_name === "string" ? b.full_name.trim() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !fullName) {
    return NextResponse.json({ error: "Send email and full_name." }, { status: 400 });
  }
  const site = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
  const admin = createAdminClient();
  const invited = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName }, redirectTo: `${site}/reset-password` });
  if (invited.error || !invited.data.user) {
    return NextResponse.json({ error: invited.error?.message ?? "Invite failed." }, { status: 400 });
  }
  // the profile row comes from the auth trigger; the join date goes through the admin RPC
  const set = await gate.auth.supabase.rpc("set_member_access", {
    member: invited.data.user.id,
    joined_on: day(b.forum_joined_on),
    left_on: null,
    founding: false,
    admin: false,
  });
  if (set.error) return NextResponse.json({ error: set.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: invited.data.user.id });
}

/** PATCH { id, forum_joined_on?, forum_left_on?, is_founding?, is_admin? } — change access; omitted fields keep their value. */
export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof b.id === "string" ? b.id : "";
  const { data: cur } = await gate.auth.supabase
    .from("profiles")
    .select("forum_joined_on, forum_left_on, is_founding, is_admin")
    .eq("id", id)
    .maybeSingle();
  if (!cur) return NextResponse.json({ error: "No such member." }, { status: 404 });
  const pick = <T,>(k: string, parse: (v: unknown) => T, fallback: T) => (k in b ? parse(b[k]) : fallback);
  const { error } = await gate.auth.supabase.rpc("set_member_access", {
    member: id,
    joined_on: pick("forum_joined_on", day, cur.forum_joined_on),
    left_on: pick("forum_left_on", day, cur.forum_left_on),
    founding: pick("is_founding", (v) => v === true, cur.is_founding),
    admin: pick("is_admin", (v) => v === true, cur.is_admin),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/** DELETE { id } — the member leaves today: from now on they see nothing. */
export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof b.id === "string" ? b.id : "";
  if (id === gate.auth.user.id) return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });
  const { data: cur } = await gate.auth.supabase.from("profiles").select("forum_joined_on, is_founding, is_admin").eq("id", id).maybeSingle();
  if (!cur) return NextResponse.json({ error: "No such member." }, { status: 404 });
  const { error } = await gate.auth.supabase.rpc("set_member_access", {
    member: id,
    joined_on: cur.forum_joined_on,
    left_on: today(),
    founding: cur.is_founding,
    admin: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
