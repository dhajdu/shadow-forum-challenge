"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AskAI } from "@/components/AskAI";

const SUGGESTIONS = ["What did I commit to at the last forum?", "Summarise the newest agenda"];

/** "Ask AI" floating at the bottom right of every page; opens a panel with the member's conversations. */
export function AskDock() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // the Ask AI page is the same thing, full size; the Constitution gate stays uncluttered
  if (path === "/ask" || path.startsWith("/forum/resources/constitution")) return null;

  return (
    <>
      {open && (
        <section className="ask-panel" role="dialog" aria-label="Ask AI about the forum">
          <header className="ask-head">
            <b>Ask AI about the forum</b>
            <button type="button" className="ask-tool" onClick={() => setOpen(false)} aria-label="Close Ask AI">
              ×
            </button>
          </header>
          <AskAI suggestions={SUGGESTIONS} autoFocus />
        </section>
      )}
      <button type="button" className={`ask-fab ${open ? "on" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span aria-hidden>✦</span> Ask AI
      </button>
    </>
  );
}
