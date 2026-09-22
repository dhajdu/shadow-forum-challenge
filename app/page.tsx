"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ text: error.message, ok: false });
      else router.push("/dashboard");
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMsg({ text: error.message, ok: false });
      else setMsg({ text: "Check your email to confirm access.", ok: true });
    }
    setBusy(false);
  }

  return (
    <main className="wrap">
      {/* atmospheric gradient backdrop */}
      <div className="hero" />
      {/* generated hero photo layered on top (falls back to gradient if absent) */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url(/hero.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="scrim" />

      <section className="panel">
        <div className="eyebrow">By invitation only</div>
        <h1 className="title">The Shadow Forum</h1>
        <p className="tagline">Into the Shadow</p>

        <form onSubmit={onSubmit}>
          <input
            className="field"
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="field"
            type="password"
            placeholder="Password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "…" : mode === "signin" ? "Enter" : "Request Access"}
          </button>
        </form>

        {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}

        <div className="toggle">
          {mode === "signin" ? (
            <>
              Not a member?{" "}
              <button onClick={() => { setMode("signup"); setMsg(null); }}>
                Request access
              </button>
            </>
          ) : (
            <>
              Already inside?{" "}
              <button onClick={() => { setMode("signin"); setMsg(null); }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </section>

      <div className="footer">The Shadow Forum</div>
    </main>
  );
}
