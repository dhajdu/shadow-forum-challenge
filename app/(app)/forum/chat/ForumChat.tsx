"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/app/_data/chat";
import s from "./chat.module.css";

type People = Record<string, { name: string; avatar: string | null }>;

const TZ = "Asia/Ho_Chi_Minh";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

/**
 * The forum's group chat. Reads and live updates run on the member's own session, so Postgres
 * decides which messages arrive (from their first forum on).
 */
export function ForumChat({ initial, people, me, isAdmin }: { initial: ChatMessage[]; people: People; me: string; isAdmin: boolean }) {
  const db = useMemo(() => createClient() as unknown as SupabaseClient, []);
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    const { data, error } = await db
      .from("forum_messages")
      .insert({ body })
      .select("id, author_id, body, created_at, edited_at, deleted_at")
      .single();
    if (error) setError(error.message);
    else {
      setText("");
      const row = data as ChatMessage;
      setMessages((xs) => (xs.some((x) => x.id === row.id) ? xs : [...xs, row]));
    }
    setBusy(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this message?")) return;
    const { error } = await db.from("forum_messages").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) setError(error.message);
  }

  let lastDay = "";
  let lastAuthor = "";

  return (
    <div className={s.chat}>
      <ol className={s.list} aria-live="polite">
        {messages.length === 0 && <li className="trend-empty">No messages yet. Say hello to the forum.</li>}
        {messages.map((m) => {
          const d = dayKey(m.created_at);
          const newDay = d !== lastDay;
          const grouped = !newDay && lastAuthor === m.author_id;
          lastDay = d;
          lastAuthor = m.author_id;
          const who = people[m.author_id]?.name ?? "Member";
          const mine = m.author_id === me;
          return (
            <li key={m.id}>
              {newDay && <div className={s.day}><span>{dayLabel(m.created_at)}</span></div>}
              <div className={`${s.msg} ${grouped ? s.grouped : ""}`}>
                <span className={s.avatar} aria-hidden>
                  {!grouped && (people[m.author_id]?.avatar ? (
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
                      <span>{time(m.created_at)}</span>
                    </div>
                  )}
                  {m.deleted_at ? (
                    <p className={s.deleted}>Message deleted</p>
                  ) : (
                    <p className={s.body}>{m.body}</p>
                  )}
                </div>
                {!m.deleted_at && (mine || isAdmin) && (
                  <button type="button" className={s.del} onClick={() => remove(m.id)} aria-label="Delete message">
                    Delete
                  </button>
                )}
              </div>
            </li>
          );
        })}
        <div ref={endRef} />
      </ol>

      <form
        className={s.composer}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          className="field"
          rows={1}
          value={text}
          maxLength={4000}
          placeholder="Message the forum…"
          aria-label="Message the forum"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn inline" type="submit" disabled={busy || !text.trim()}>
          Send
        </button>
      </form>
      {error && <p className="msg err">{error}</p>}
      <p className={s.hint}>Only forum members see this chat, and each member sees it from their first forum on.</p>
    </div>
  );
}
