"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OAuthAuthorizationDetails } from "@supabase/supabase-js";
import { useForumSettings } from "@/components/ForumSettingsProvider";

const SCOPE_LABEL: Record<string, string> = {
  openid: "Know it's you",
  email: "See your email address",
  profile: "See your name",
};

function hostOf(uri: string | undefined): string | null {
  try {
    return uri ? new URL(uri).host || null : null;
  } catch {
    return null;
  }
}

export function Consent({ authorizationId }: { authorizationId: string }) {
  const forum = useForumSettings();
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (error || !data) return setError(error?.message ?? "This request has expired. Start again from your assistant.");
      // already consented: go straight back to the client
      if (!("authorization_id" in data)) return window.location.assign(data.redirect_url);
      setDetails(data);
    });
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const supabase = createClient();
    const opts = { skipBrowserRedirect: true };
    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, opts)
      : await supabase.auth.oauth.denyAuthorization(authorizationId, opts);
    if (error || !data) {
      setError(error?.message ?? "Something went wrong.");
      setBusy(false);
      return;
    }
    window.location.assign(data.redirect_url);
  }

  if (error) return <p className="msg err">{error}</p>;
  if (!details) return <p className="toggle">Checking the request…</p>;

  const scopes = details.scope.split(/\s+/).filter(Boolean);
  // The name is whatever the client registered with; the address it sends you back to is what identifies it.
  const host = hostOf(details.redirect_uri);
  return (
    <div className="consent">
      <h1 className="consent-title">{details.client.name || "An assistant"} wants to use your forum account</h1>
      <p className="consent-p">
        Signed in as <b>{details.user.email}</b>. If you allow it, you go back to <b>{host ?? "an unknown address"}</b>. Allow it only
        if you started this from your own assistant and you recognise that address.
      </p>
      <p className="consent-p">
        It acts as you and sees only what you can see in the {forum.shortName}, from your first forum on. It can:
      </p>
      <ul className="consent-list">
        <li>Read agendas, the Parking Lot, chat, the kitty, goals, standings, photos and your own biometrics</li>
        <li>Post chat messages as you</li>
        <li>Add and void kitty entries</li>
        <li>Set and update your contest goal and personal goals</li>
        <li>If you are an admin: change forum plans, run sheets, presenters, planners and roles</li>
      </ul>
      {scopes.length > 0 && (
        <ul className="consent-list">
          {scopes.map((s) => (
            <li key={s}>{SCOPE_LABEL[s] ?? s}</li>
          ))}
        </ul>
      )}
      <div className="consent-actions">
        <button className="btn" onClick={() => decide(true)} disabled={busy}>Allow</button>
        <button className="btn-ghost" onClick={() => decide(false)} disabled={busy}>Deny</button>
      </div>
    </div>
  );
}
