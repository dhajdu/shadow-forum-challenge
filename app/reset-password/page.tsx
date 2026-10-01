"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { changePassword, type ProfileState } from "@/app/actions/profile";
import { PasswordField } from "@/components/PasswordField";

const initial: ProfileState = { error: null, ok: false };

// Reached from the reset email via /auth/confirm, which signs the rider in first.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, action, pending] = useActionState(changePassword, initial);

  useEffect(() => {
    if (state.ok) router.push("/race");
  }, [state.ok, router]);

  return (
    <main className="wrap">
      <div className="hero" />
      <div className="scrim" />
      <section className="panel">
        <div className="eyebrow">The Shadow Forum</div>
        <h1 className="title">New password</h1>
        <form action={action}>
          <PasswordField name="password" placeholder="New password" autoComplete="new-password" minLength={6} required />
          <PasswordField name="confirm" placeholder="Confirm new password" autoComplete="new-password" minLength={6} required />
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "…" : "Set password"}
          </button>
        </form>
        {state.error && <div className="msg err">{state.error}</div>}
        {state.ok && <div className="msg ok">Password updated.</div>}
      </section>
    </main>
  );
}
