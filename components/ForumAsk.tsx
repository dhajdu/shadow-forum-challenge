"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Cite = { id: string; held_on: string; title: string | null };
type Msg = { role: "user" | "assistant"; content: string; cited?: Cite[] };

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Ask about the forum's agendas (POST /api/ask). The server answers on the member's own
 * session, so it only ever sees forums the member may see; citations come back in the
 * x-cited-meetings header.
 */
export function ForumAsk({
  meeting,
  suggestions,
}: {
  meeting?: { id: string; label: string } | null;
  suggestions: string[];
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // the member's own history
  useEffect(() => {
    if (meeting) return; // a scoped question starts fresh
    fetch("/api/ask")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { messages?: { role: Msg["role"]; content: string }[] } | null) => {
        if (d?.messages) setMessages(d.messages.map((m) => ({ role: m.role, content: m.content })));
      })
      .catch(() => {});
  }, [meeting]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

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
        body: JSON.stringify({ question: q, meetingId: meeting?.id }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong.");
      } else {
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
    <div className="assistant">
      {meeting && <p className="note-line">Asking about {meeting.label}.</p>}
      <div className="chat">
        {messages.length === 0 && <div className="chat-empty">Ask AI about your forums: what was agreed, who committed to what, what came up. The AI answers from the agendas you can see and cites them.</div>}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.content}
            {m.cited && m.cited.length > 0 && (
              <span className="cites">
                Source:{" "}
                {m.cited.map((c, j) => (
                  <span key={c.id}>
                    {j > 0 && ", "}
                    <Link href={`/forum/${c.id}`}>{fmt(c.held_on)} {c.title ?? "agenda"}</Link>
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
            <button key={s} type="button" onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
      )}

      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input className="field" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask AI about the forum…" aria-label="Question for the AI" />
        <button className="btn chat-send" type="submit" disabled={busy || !input.trim()}>{busy ? "…" : "Ask AI"}</button>
      </form>
    </div>
  );
}
