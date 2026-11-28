"use client";

import { useActionState } from "react";
import { updateProfile, changePassword, type ProfileState } from "@/app/actions/profile";
import { PasswordField } from "@/components/PasswordField";

const initial: ProfileState = { error: null, ok: false };

/** Name and password on Profile. The photo has its own uploader (AvatarUpload). */
export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfile, initial);
  const [pwState, pwAction, pwPending] = useActionState(changePassword, initial);

  return (
    <>
      <section className="zone-card">
        <h2>Your details</h2>
        <form action={profileAction} className="pform">
          <label htmlFor="pf-name">Display name</label>
          <input id="pf-name" className="field" name="full_name" defaultValue={fullName} required />

          <label htmlFor="pf-email">Email</label>
          <input id="pf-email" className="field" value={email} readOnly />

          {profileState.error && <div className="msg err">{profileState.error}</div>}
          {profileState.ok && <div className="msg ok">Saved.</div>}
          <button className="btn" type="submit" disabled={profilePending}>
            {profilePending ? "…" : "Save changes"}
          </button>
        </form>
      </section>

      <section className="zone-card">
        <h2>Password</h2>
        <form action={pwAction} className="pform">
          <PasswordField name="password" placeholder="New password" minLength={6} required />
          <PasswordField name="confirm" placeholder="Confirm new password" minLength={6} required />
          {pwState.error && <div className="msg err">{pwState.error}</div>}
          {pwState.ok && <div className="msg ok">Password updated.</div>}
          <button className="btn" type="submit" disabled={pwPending}>
            {pwPending ? "…" : "Update password"}
          </button>
        </form>
      </section>
    </>
  );
}
