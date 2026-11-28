"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Chat icon with an unread count. Starts from the server's count (messages since this member's
 * read mark), adds new messages from others live, and clears on the Chat page.
 */
export function ChatBell({ unread, me, className }: { unread: number; me: string; className: string }) {
  const pathname = usePathname();
  const onChat = pathname === "/chat";
  const [count, setCount] = useState(unread);
  const db = useMemo(() => createClient() as unknown as SupabaseClient, []);

  useEffect(() => setCount(onChat ? 0 : unread), [unread, onChat]);

  useEffect(() => {
    const channel = db
      .channel(`chat-bell-${className}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "forum_messages" }, (payload) => {
        const row = payload.new as { author_id?: string };
        if (row.author_id && row.author_id !== me && window.location.pathname !== "/chat") setCount((n) => n + 1);
      })
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [db, me, className]);

  const label = count > 0 ? `Chat, ${count} unread` : "Chat";
  return (
    <Link href="/chat" className={`chat-bell ${className} ${onChat ? "on" : ""}`} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M4 5h16v11H9l-5 4z" />
      </svg>
      {count > 0 && <span className="chat-badge">{count > 9 ? "9+" : count}</span>}
    </Link>
  );
}
