"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Cite = { id: string; held_on: string; title: string | null };
type Msg = { role: "user" | "assistant"; content: string; cited?: Cite[] };
type Conversation = { id: string; title: string; updated_at: string };

const LAST_KEY = "sf_ask_conversation";
const fmt = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function remembered(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}
function remember(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_KEY, id);
    else localStorage.removeItem(LAST_KEY);
  } catch {}
}

/**
 * Ask AI about the forum, in conversations. The server answers on the member's own session
 * (POST /api/ask), so it only sees forums the member may see. Used by the floating panel and
 * the Ask AI page. `meeting` scopes a fresh conversation to one forum.
 */
export function AskAI({
  suggestions,
  meeting,
  autoFocus,
}: {
  suggestions: string[];
  meeting?: { id: string; label: string } | null;
  autoFocus?: boolean;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [list, setList] = useState<Conversation[] | null>(null);
  const [showList, setShowList] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const open = useCallback(async (id: string | null) => {
    setShowList(false);
    setError(null);
    setConversationId(id);
    remember(id);
    if (!id) return setMessages([]);
    const d = await fetch(`/api/ask?conversation=${id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setMessages(((d?.messages ?? []) as Msg[]).map((m) => ({ role: m.role, content: m.content })));
  }, []);

  // pick up where the member left off, unless this is a question about one forum
  useEffect(() => {
    if (!meeting) void open(remembered());
  }, [meeting, open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  async function loadList() {
    setShowList(true);
    const d = await fetch("/api/ask?conversations=1").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setList((d?.conversations ?? []) as Conversation[]);
  }

  async function forget(id: string) {
    await fetch(`/api/ask?conversation=${id}`, { method: "DELETE" }).catch(() => {});
    setList((l) => (l ?? []).filter((c) => c.id !== id));
    if (id === conversationId) void open(null);
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, meetingId: meeting?.id, conversationId: conversationId ?? "new" }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong.");
      } else {
        const id = res.headers.get("x-conversation-id");
        if (id) {
          setConversationId(id);
          remember(id);
        }
        let cited: Cite[] = [];
        try {
          cited = JSON.parse(decodeURIComponent(res.headers.get("x-cited-meetings") ?? "%5B%5D")) as Cite[];
        } catch {}
        setMessages((m) => [...m, { role: "assistant", content: "", cited }]);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setMessages((m) => {
            const last = m[m.length - 1];
            return [...m.slice(0, -1), { ...last, content: last.content + chunk }];
          });
        }
      }
    } catch {
      setError("Network error.");
    }
    setBusy(false);
  }

  return (
    <div className="ask">
      <div className="ask-bar">
        <button type="button" className="ask-tool" onClick={() => (showList ? setShowList(false) : loadList())} aria-pressed={showList}>
          {showList ? "← Back" : "Conversations"}
        </button>
        <button type="button" className="ask-tool" onClick={() => open(null)} disabled={busy}>
          + New
        </button>
      </div>

      {showList ? (
        <ul className="ask-list">
          {list === null && <li className="note-line">Loading…</li>}
          {list?.length === 0 && <li className="note-line">No conversations yet.</li>}
          {list?.map((c) => (
            <li key={c.id} className={c.id === conversationId ? "on" : ""}>
              <button type="button" className="ask-open" onClick={() => open(c.id)}>
                <span>{c.title}</span>
                <small>{fmt(c.updated_at)}</small>
              </button>
              <button type="button" className="ask-forget" onClick={() => forget(c.id)} aria-label={`Delete "${c.title}"`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="chat ask-chat">
            {meeting && messages.length === 0 && <p className="note-line">Asking about {meeting.label}.</p>}
            {messages.length === 0 && (
              <div className="chat-empty">
                Ask about your forums: what was agreed, who committed to what. Answers come from the agendas you can see, with sources.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                {m.content}
                {m.cited && m.cited.length > 0 && (
                  <span className="cites">
                    Source:{" "}
                    {m.cited.map((c, j) => (
                      <span key={c.id}>
                        {j > 0 && ", "}
                        <Link href={`/forum/${c.id}`}>
                          {fmt(c.held_on)} {c.title ?? "agenda"}
                        </Link>
                      </span>
                    ))}
                  </span>
                )}
              </div>
            ))}
            {busy && messages[messages.length - 1]?.role !== "assistant" && <div className="bubble assistant loading">Thinking…</div>}
            {error && <div className="msg err">{error}</div>}
            <div ref={endRef} />
          </div>

          {messages.length === 0 && (
            <div className="chat-sugg">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className="ask-form"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <input
              className="field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask AI about the forum…"
              aria-label="Question for the AI"
              autoFocus={autoFocus}
            />
            <button className="ask-send" type="submit" disabled={busy || !input.trim()} aria-label="Ask AI">
              {busy ? "…" : "↑"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
