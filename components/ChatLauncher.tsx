"use client";

import { useEffect, useState } from "react";
import { Assistant } from "@/components/Assistant";

const OPEN_KEY = "sf-chat-open";

// Floating chat bubble, rendered on every signed-in page via the NavBar.
export function ChatLauncher() {
  const [open, setOpen] = useState(false);

  // keep the panel open across page navigations
  useEffect(() => {
    try {
      setOpen(sessionStorage.getItem(OPEN_KEY) === "1");
    } catch {}
  }, []);

  function toggle(next: boolean) {
    setOpen(next);
    try {
      sessionStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {}
  }

  return (
    <>
      {open && (
        <div className="chat-panel" role="dialog" aria-label="Ask about your data">
          <div className="chat-panel-head">
            <b>Ask about your data</b>
            <button type="button" className="chat-close" onClick={() => toggle(false)} aria-label="Close chat">
              ×
            </button>
          </div>
          <Assistant />
        </div>
      )}
      <button
        type="button"
        className={`chat-fab ${open ? "on" : ""}`}
        onClick={() => toggle(!open)}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? "×" : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          </svg>
        )}
      </button>
    </>
  );
}
