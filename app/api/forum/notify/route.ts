import { NextResponse, type NextRequest } from "next/server";
import { requireMember } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadMembers } from "@/lib/access";
import { sendPush } from "@/lib/push";

export const dynamic = "force-dynamic";

// After posting a chat message, the client calls this so the other members get
// "New message in the forum chat". Lock-screen text never carries the message.
// One push per message at most, only for the author's own fresh message, and at
// most one chat push every few minutes so a busy conversation doesn't buzz phones.
const FRESH_MS = 10 * 60 * 1000;
const QUIET_MS = 3 * 60 * 1000;

/** POST { message_id } */
export async function POST(req: NextRequest) {
  const gate = await requireMember(req);
  if (!gate.ok) return gate.res;
  const b = (await req.json().catch(() => ({}))) as { message_id?: unknown };
  const id = typeof b.message_id === "string" ? b.message_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Send message_id." }, { status: 400 });

  const admin = createAdminClient();
  const { data: msg } = await admin
    .from("forum_messages")
    .select("id, author_id, sent_on, created_at, deleted_at, notified_at")
    .eq("id", id)
    .maybeSingle();
  if (!msg || msg.author_id !== gate.auth.user.id) return NextResponse.json({ error: "No such message." }, { status: 404 });
  if (msg.notified_at || msg.deleted_at || Date.now() - new Date(msg.created_at).getTime() > FRESH_MS) {
    return NextResponse.json({ ok: true, pushed: false });
  }

  // Claim the message first so a double call cannot push twice.
  const { data: claimed } = await admin
    .from("forum_messages")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", id)
    .is("notified_at", null)
    .select("id");
  if (!claimed?.length) return NextResponse.json({ ok: true, pushed: false });

  const since = new Date(Date.now() - QUIET_MS).toISOString();
  const { count } = await admin
    .from("forum_messages")
    .select("id", { count: "exact", head: true })
    .neq("id", id)
    .gte("notified_at", since);
  if ((count ?? 0) > 0) return NextResponse.json({ ok: true, pushed: false, quiet: true });

  const members = await loadMembers(admin);
  const others = members.filter((m) => m.id !== msg.author_id).map((m) => m.id);
  const result = await sendPush(admin, others, { kind: "forum_message", sentOn: msg.sent_on }, members);
  return NextResponse.json({ ok: true, pushed: true, ...result });
}
