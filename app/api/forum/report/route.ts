import { NextResponse, type NextRequest } from "next/server";
import { requireMember } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isActive, loadMembers } from "@/lib/access";
import { sendEmail } from "@/lib/notify";
import { sendPush } from "@/lib/push";
import { getForumSettings } from "@/lib/forum-settings";

export const dynamic = "force-dynamic";

// Report a chat message (App Store guideline 1.2). The message is read on the member's own
// session, so only a message they can see can be reported. The report keeps the text as it was,
// and every active admin gets an email with the details and a push that carries none.
// With block: true the reporter also blocks the author (member_blocks, migration 0038).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** POST { message_id, reason?, block? } */
export async function POST(req: NextRequest) {
  const gate = await requireMember(req);
  if (!gate.ok) return gate.res;
  const { supabase, user } = gate.auth;
  const b = (await req.json().catch(() => ({}))) as { message_id?: unknown; reason?: unknown; block?: unknown };
  const id = typeof b.message_id === "string" ? b.message_id : "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Send message_id." }, { status: 400 });
  const reason = typeof b.reason === "string" && b.reason.trim() ? b.reason.trim().slice(0, 500) : null;

  const { data: msg } = await supabase.from("forum_messages").select("id, author_id, body, created_at").eq("id", id).maybeSingle();
  if (!msg) return NextResponse.json({ error: "No such message." }, { status: 404 });
  if (msg.author_id === user.id) return NextResponse.json({ error: "You can't report your own message." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("chat_reports")
    .insert({ message_id: msg.id, reporter_id: user.id, author_id: msg.author_id, body: msg.body, reason });
  if (error) return NextResponse.json({ error: "The report could not be saved. Try again." }, { status: 500 });

  if (b.block === true) {
    await admin.from("member_blocks").upsert({ blocker_id: user.id, blocked_id: msg.author_id }, { ignoreDuplicates: true });
  }

  const members = await loadMembers(admin);
  const admins = members.filter((m) => m.is_admin && isActive(m));
  const name = (uid: string) => members.find((m) => m.id === uid)?.full_name || "A member";
  const forum = await getForumSettings();
  const html = `
    <p><b>${esc(name(user.id))}</b> reported a message by <b>${esc(name(msg.author_id))}</b> in the ${esc(forum.name)} chat.</p>
    <blockquote>${esc(msg.body) || "<i>(no text)</i>"}</blockquote>
    ${reason ? `<p>Reason: ${esc(reason)}</p>` : ""}
    <p>Sent ${esc(new Date(msg.created_at).toUTCString())}. Review it within 24 hours: delete the message in the chat (tap it, then Delete), and if needed end the member's access in Me &gt; Members and access.</p>`;
  await Promise.all(
    admins.filter((m) => m.email).map((m) => sendEmail({ to: m.email!, subject: `${forum.name}: a chat message was reported`, html }).catch(() => null)),
  );
  await sendPush(admin, admins.map((m) => m.id), { kind: "chat_report" }, members).catch(() => null);

  return NextResponse.json({ ok: true });
}
