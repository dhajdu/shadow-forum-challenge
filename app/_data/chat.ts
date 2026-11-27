// Forum group chat: forum_messages under the same date rule as agendas, read on the member's session.
// `t()` drops the generated types until lib/database.types.ts has forum_messages.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Db } from "./types";

const t = (db: Db) => db as unknown as SupabaseClient;

export type ChatMessage = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export const CHAT_PAGE = 100;

/** The newest messages the member may see, oldest first. Empty until the table exists. */
export async function listChat(db: Db): Promise<ChatMessage[]> {
  const { data, error } = await t(db)
    .from("forum_messages")
    .select("id, author_id, body, created_at, edited_at, deleted_at")
    .order("created_at", { ascending: false })
    .limit(CHAT_PAGE);
  if (error || !data) return [];
  return (data as ChatMessage[]).reverse();
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
