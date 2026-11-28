"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { CHAT_COLS, type ChatMessage } from "@/app/_data/chat";
import { useForumSettings } from "@/components/ForumSettingsProvider";
import s from "./chat.module.css";

type People = Record<string, { name: string; avatar: string | null }>;

// Days and times in the forum's time zone (forum settings).
const dayKey = (iso: string, timeZone: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone });
const dayLabel = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone });
const time = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

/**
 * The forum's group chat, with threads: a reply (reply_to) sits in the thread under the message it
 * answers, not in the main list. Reads and live updates run on the member's own session, so
 * Postgres decides which messages arrive.
 */
export function ForumChat({ initial, people, me }: { initial: ChatMessage[]; people: People; me: string }) {
  const db = useMemo(() => createClient() as unknown as SupabaseClient, []);
  const tz = useForumSettings().timeZone;
  const [messages, setMessages] = useState(initial);
  const [thread, setThread] = useState<string | null>(null); // the open thread's first message
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // live: new and edited messages
  useEffect(() => {
    const channel = db
      .channel("forum-chat")
      .on("postgres_changes", { event: "*", schema: "public", table: "forum_messages" }, (payload) => {
        const row = payload.new as ChatMessage;
        if (!row?.id) return;
        setMessages((xs) => {
          const i = xs.findIndex((x) => x.id === row.id);
          if (i >= 0) return xs.map((x) => (x.id === row.id ? row : x));
          return [...xs, row];
        });
      })
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [db]);

  // each reply belongs to the thread of the top-level message its reply chain starts from
  const { top, replies } = useMemo(() => {
    const byId = new Map(messages.map((m) => [m.id, m]));
    const rootOf = (m: ChatMessage): string | null => {
      let cur = m;
      for (let hops = 0; cur.reply_to && hops < 50; hops++) {
        const parent = byId.get(cur.reply_to);
        if (!parent) return null; // its thread started before the loaded window
        cur = parent;
      }
      return cur.reply_to ? null : cur.id;
    };
    const top: ChatMessage[] = [];
    const replies = new Map<string, ChatMessage[]>();
    for (const m of messages) {
      if (!m.reply_to) top.push(m);
      else {
        const root = rootOf(m);
        if (root) replies.set(root, [...(replies.get(root) ?? []), m]);
      }
    }
    return { top, replies };
  }, [messages]);

  const open = thread ? top.find((m) => m.id === thread) ?? null : null;
  const openReplies = open ? replies.get(open.id) ?? [] : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
    // mark the chat read up to now (owner-only row)
    db.from("forum_read_marks").upsert({ last_read_at: new Date().toISOString() }).then(() => {});
  }, [top.length, db]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [thread, openReplies.length]);

  useEffect(() => {
    if (!thread) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setThread(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [thread]);

  async function send(body: string, replyTo: string | null): Promise<boolean> {
    setError(null);
    const { data, error } = await db
      .from("forum_messages")
      .insert(replyTo ? { body, reply_to: replyTo } : { body })
      .select(CHAT_COLS)
      .single();
    if (error) {
      setError(error.message);
      return false;
    }
    const row = data as ChatMessage;
    setMessages((xs) => (xs.some((x) => x.id === row.id) ? xs : [...xs, row]));
    // tell the other members' phones (generic text; the server rate-limits and dedupes)
    fetch("/api/forum/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message_id: row.id }),
    }).catch(() => {});
    return true;
  }

  async function remove(id: string) {
    if (!confirm("Delete this message?")) return;
    const { error } = await db.from("forum_messages").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) setError(error.message);
  }

  const row = (m: ChatMessage, grouped: boolean, inThread: boolean) => {
    const who = people[m.author_id]?.name ?? "Member";
    const rs = inThread ? [] : replies.get(m.id) ?? [];
    return (
      <div className={`${s.msg} ${grouped ? s.grouped : ""} ${!inThread && thread === m.id ? s.active : ""}`}>
        <span className={s.avatar} aria-hidden>
          {!grouped &&
            (people[m.author_id]?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar from Storage
              <img src={people[m.author_id]!.avatar!} alt="" />
            ) : (
              initials(who)
            ))}
        </span>
        <div className={s.content}>
          {!grouped && (
            <div className={s.meta}>
              <b>{who}</b>
              <span>{time(m.created_at, tz)}</span>
            </div>
          )}
          {m.deleted_at ? <p className={s.deleted}>Message deleted</p> : <p className={s.body}>{m.body}</p>}
          {rs.length > 0 && (
            <button type="button" className={s.replies} onClick={() => setThread(m.id)}>
              {rs.length} {rs.length === 1 ? "reply" : "replies"}
              <span>Last {time(rs[rs.length - 1].created_at, tz)}</span>
            </button>
          )}
        </div>
        <span className={s.actions}>
          {!inThread && !m.deleted_at && (
            <button type="button" onClick={() => setThread(m.id)} aria-label={`Reply in thread to ${who}`}>
              Reply
            </button>
          )}
          {!m.deleted_at && m.author_id === me && (
            <button type="button" className={s.del} onClick={() => remove(m.id)} aria-label="Delete message">
              Delete
            </button>
          )}
        </span>
      </div>
    );
  };

  let lastDay = "";
  let lastAuthor = "";

  return (
    <div className={`${s.chat} ${open ? s.withThread : ""}`}>
      <div className={s.main}>
        <ol className={s.list} aria-live="polite">
          {top.length === 0 && <li className="trend-empty">No messages yet. Say hello to the forum.</li>}
          {top.map((m) => {
            const d = dayKey(m.created_at, tz);
            const newDay = d !== lastDay;
            // a message with a thread under it ends the group
            const grouped = !newDay && lastAuthor === m.author_id;
            lastDay = d;
            lastAuthor = (replies.get(m.id)?.length ?? 0) > 0 ? "" : m.author_id;
            return (
              <li key={m.id}>
                {newDay && (
                  <div className={s.day}>
                    <span>{dayLabel(m.created_at, tz)}</span>
                  </div>
                )}
                {row(m, grouped, false)}
              </li>
            );
          })}
          <div ref={endRef} />
        </ol>
        <Composer placeholder="Message the forum…" onSend={(b) => send(b, null)} />
        {error && !open && <p className="msg err">{error}</p>}
        <p className={s.hint}>Only forum members see this chat. Reply to a message to start a thread under it.</p>
      </div>

      {open && (
        <aside className={s.thread} aria-label="Thread">
          <header className={s.threadHead}>
            <b>Thread</b>
            <button type="button" onClick={() => setThread(null)} aria-label="Close thread">
              ×
            </button>
          </header>
          <ol className={s.threadList}>
            <li>{row(open, false, true)}</li>
            <li className={s.count}>
              {openReplies.length === 0 ? "No replies yet" : `${openReplies.length} ${openReplies.length === 1 ? "reply" : "replies"}`}
            </li>
            {openReplies.map((m, i) => (
              <li key={m.id}>{row(m, i > 0 && openReplies[i - 1].author_id === m.author_id, true)}</li>
            ))}
            <div ref={threadEndRef} />
          </ol>
          <Composer key={open.id} placeholder="Reply in thread…" autoFocus onSend={(b) => send(b, open.id)} />
          {error && <p className="msg err">{error}</p>}
        </aside>
      )}
    </div>
  );
}

function Composer({ placeholder, autoFocus, onSend }: { placeholder: string; autoFocus?: boolean; onSend: (body: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    if (await onSend(body)) setText("");
    setBusy(false);
  }
  return (
    <form
      className={s.composer}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        className="field"
        rows={1}
        value={text}
        maxLength={4000}
        placeholder={placeholder}
        aria-label={placeholder.replace("…", "")}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button className="btn inline" type="submit" disabled={busy || !text.trim()}>
        Send
      </button>
    </form>
  );
}
