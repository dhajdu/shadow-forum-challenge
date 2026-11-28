import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TabNav } from "@/components/TabNav";
import { ChatBell } from "@/components/ChatBell";
import { AskDock } from "@/components/AskDock";
import { SignOutButton } from "@/components/SignOutButton";
import { getForumContext } from "@/app/_data/context";

/** Messages from others since this member last opened Chat (RLS limits them to what they may see). */
async function unreadChat(): Promise<{ me: string; unread: number }> {
  const { db, user } = await getForumContext();
  const sb = db as unknown as SupabaseClient;
  try {
    const { data: mark } = await sb.from("forum_read_marks").select("last_read_at").eq("user_id", user.id).maybeSingle();
    const since = (mark as { last_read_at: string } | null)?.last_read_at ?? new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { count } = await sb
      .from("forum_messages")
      .select("id", { count: "exact", head: true })
      .gt("created_at", since)
      .neq("author_id", user.id)
      .is("deleted_at", null);
    return { me: user.id, unread: count ?? 0 };
  } catch {
    return { me: user.id, unread: 0 };
  }
}

/** Signed-in frame: sidebar on desktop, bottom tabs on phone widths, Chat icon top right, Ask AI floating bottom right. */
export async function AppShell({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  const { me, unread } = await unreadChat();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-top">
          <Link href="/" className="side-brand">THE SHADOW</Link>
          <ChatBell unread={unread} me={me} className="in-side" />
        </div>
        <TabNav variant="side" />
        <div className="side-foot">
          {isAdmin && <Link href="/me/members">Members and access</Link>}
          <SignOutButton className="side-signout" />
        </div>
      </aside>
      <ChatBell unread={unread} me={me} className="floating" />
      <div className="shell-main">{children}</div>
      <TabNav variant="bottom" />
      <AskDock />
    </div>
  );
}
