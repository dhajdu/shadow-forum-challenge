"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signUpWithCode } from "@/app/actions/signup";
import { PasswordField } from "@/components/PasswordField";

type Mode = "signin" | "signup" | "forgot";

export default function Home() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("signup");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // /auth/confirm bounces here when a reset link is invalid or used up
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reset") === "expired") {
      setMode("forgot");
      setMsg({ text: "That reset link has expired. Request a new one.", ok: false });
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
      });
      if (error) setMsg({ text: error.message, ok: false });
      else setMsg({ text: "If that email has an account, a reset link is on its way.", ok: true });
    } else if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ text: error.message, ok: false });
      else router.push("/race");
    } else {
      const form = new FormData();
      form.set("code", code);
      form.set("name", name);
      form.set("email", email);
      form.set("password", password);
      const res = await signUpWithCode(form);
      if (res.error) {
        setMsg({ text: res.error, ok: false });
      } else {
        router.push("/welcome");
        router.refresh();
      }
    }
    setBusy(false);
  }

  return (
    <main className="wrap">
      <div className="hero" />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url(/hero.webp)",
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
          {mode === "signup" && (
            <>
              <input
                className="field"
                type="text"
                placeholder="Access code"
                autoComplete="off"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <input
                className="field"
                type="text"
                placeholder="Full name"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </>
          )}
          <input
            className="field"
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {mode !== "forgot" && (
            <PasswordField
              placeholder="Password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "…" : mode === "signin" ? "Enter" : mode === "forgot" ? "Send reset link" : "Join the Forum"}
          </button>
        </form>

        {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}

        <div className="toggle">
          {mode === "signup" ? (
            <>
              Already inside?{" "}
              <button onClick={() => { setMode("signin"); setMsg(null); }}>
                Sign in
              </button>
            </>
          ) : mode === "forgot" ? (
            <>
              Remembered it?{" "}
              <button onClick={() => { setMode("signin"); setMsg(null); }}>
                Sign in
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setMode("forgot"); setMsg(null); }}>
                Forgot password?
              </button>
              <br />
              Have an access code?{" "}
              <button onClick={() => { setMode("signup"); setMsg(null); }}>
                Join
              </button>
            </>
          )}
        </div>
      </section>

      <div className="footer">The Shadow Forum</div>
    </main>
  );
}
