"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AddPasskeyButton() {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function addPasskey() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.registerPasskey();
    if (!error) {
      setMsg({ text: "Passkey added. Use it next time you sign in.", ok: true });
    } else if ("code" in error && error.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
      setMsg({ text: "This device already has a passkey.", ok: true });
    } else if (!("code" in error && error.code === "ERROR_CEREMONY_ABORTED")) {
      setMsg({ text: error.message, ok: false });
    }
    setBusy(false);
  }

  return (
    <>
      <button className="btn-ghost" onClick={addPasskey} disabled={busy}>
        {busy ? "…" : "Add a passkey"}
      </button>
      {msg && <span className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</span>}
    </>
  );
}
