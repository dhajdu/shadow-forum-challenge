"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_KEY = "sf-chat-messages";

const SUGGESTIONS = [
  "How's my recovery trending?",
  "What should I focus on to improve my score?",
  "Any red flags in my recent data?",
];

export function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  // keep the conversation for the browser session, so it survives page changes
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(CHAT_KEY);
      if (saved) setMessages(JSON.parse(saved) as Msg[]);
    } catch {}
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      sessionStorage.setItem(CHAT_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong.");
      } else {
        // stream the reply in as it arrives
        setMessages((m) => [...m, { role: "assistant", content: "" }]);
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
      <div className="chat">
        {messages.length === 0 && (
          <div className="chat-empty">
            Ask anything about your WHOOP data — trends, insights, what to improve. Only you can see your data.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>{m.content}</div>
        ))}
        {busy && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="bubble assistant loading">Thinking…</div>
        )}
        {error && <div className="msg err">{error}</div>}
        <div ref={endRef} />
      </div>

      {messages.length === 0 && (
        <div className="chat-sugg">
          {SUGGESTIONS.map((s) => (
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
        <input
          className="field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your data…"
        />
        <button className="btn chat-send" type="submit" disabled={busy || !input.trim()}>
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
