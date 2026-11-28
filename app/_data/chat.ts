// Forum group chat: forum_messages under the same date rule as agendas, read on the member's session.
import type { Db } from "./types";

export type ChatMessage = {
  id: string;
  author_id: string;
  body: string;
  reply_to: string | null; // set: a reply in the thread under that message
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export const CHAT_PAGE = 100;

export const CHAT_COLS = "id, author_id, body, reply_to, created_at, edited_at, deleted_at";

/**
 * The newest top-level messages the member may see, with the thread replies under them,
 * oldest first. Empty until the table exists.
 */
export async function listChat(db: Db): Promise<ChatMessage[]> {
  const { data, error } = await db
    .from("forum_messages")
    .select(CHAT_COLS)
    .is("reply_to", null)
    .order("created_at", { ascending: false })
    .limit(CHAT_PAGE);
  if (error || !data) return [];
  const top = (data as ChatMessage[]).reverse();
  if (top.length === 0) return top;
  const { data: replies } = await db
    .from("forum_messages")
    .select(CHAT_COLS)
    .not("reply_to", "is", null)
    .gte("created_at", top[0].created_at)
    .order("created_at")
    .limit(1000);
  return [...top, ...((replies ?? []) as ChatMessage[])].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Names and avatars for everyone the member can see. */
export async function listPeople(db: Db): Promise<Record<string, { name: string; avatar: string | null }>> {
  const { data } = await db.from("profiles").select("id, full_name, avatar_url");
  const out: Record<string, { name: string; avatar: string | null }> = {};
  for (const p of (data ?? []) as { id: string; full_name: string; avatar_url: string | null }[]) {
    out[p.id] = { name: p.full_name || "Member", avatar: p.avatar_url };
  }
  return out;
}
