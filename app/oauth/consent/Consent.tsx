"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OAuthAuthorizationDetails } from "@supabase/supabase-js";

const SCOPE_LABEL: Record<string, string> = {
  openid: "Know it's you",
  email: "See your email address",
  profile: "See your name",
};

export function Consent({ authorizationId }: { authorizationId: string }) {
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
  return (
    <div className="consent">
      <h1 className="consent-title">{details.client.name || "An assistant"} wants to read your forum</h1>
      <p className="consent-p">
        Signed in as <b>{details.user.email}</b>. It will see only what you can see in the Shadow Forum, from your first
        forum on, and it cannot change anything.
      </p>
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
