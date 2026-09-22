"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateProfile, changePassword, type ProfileState } from "@/app/actions/profile";
import { SignOutButton } from "@/components/SignOutButton";
import { PasswordField } from "@/components/PasswordField";

const initial: ProfileState = { error: null, ok: false };

export function ProfileForm({
  userId,
  fullName,
  email,
  avatarUrl,
}: {
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}) {
  const supabase = createClient();
  const [avatar, setAvatar] = useState<string | null>(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [profileState, profileAction, profilePending] = useActionState(updateProfile, initial);
  const [pwState, pwAction, pwPending] = useActionState(changePassword, initial);

  async function uploadAvatar(file: File) {
    setUploading(true);
    const path = `${userId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatar(data.publicUrl);
    }
    setUploading(false);
  }

  return (
    <div className="profile-grid">
      <section className="zone-card">
        <h2>Profile info</h2>
        <form action={profileAction} className="pform">
          <div className="avatar-row">
            <div className="avatar-lg" style={avatar ? { backgroundImage: `url(${avatar})` } : undefined} />
            <label className="btn-ghost">
              {uploading ? "Uploading…" : "Upload photo"}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
              />
            </label>
          </div>
          <input type="hidden" name="avatar_url" value={avatar ?? ""} />

          <label>Display name</label>
          <input className="field" name="full_name" defaultValue={fullName} required />

          <label>Email</label>
          <input className="field" value={email} readOnly />

          {profileState.error && <div className="msg err">{profileState.error}</div>}
          {profileState.ok && <div className="msg ok">Saved.</div>}
          <button className="btn" type="submit" disabled={profilePending}>
            {profilePending ? "…" : "Save changes"}
          </button>
        </form>
      </section>

      <section className="zone-card">
        <h2>Change password</h2>
        <form action={pwAction} className="pform">
          <PasswordField name="password" placeholder="New password" minLength={6} required />
          <PasswordField name="confirm" placeholder="Confirm new password" minLength={6} required />
          {pwState.error && <div className="msg err">{pwState.error}</div>}
          {pwState.ok && <div className="msg ok">Password updated.</div>}
          <button className="btn" type="submit" disabled={pwPending}>
            {pwPending ? "…" : "Update password"}
          </button>
        </form>

        <div className="signout-row">
          <SignOutButton />
        </div>
      </section>
    </div>
  );
}
