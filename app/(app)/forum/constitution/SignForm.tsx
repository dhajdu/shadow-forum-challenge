"use client";

import { useActionState, useState } from "react";
import { signConstitution, type SignState } from "./actions";

const initial: SignState = { error: null, ok: false };

/** Typed-name e-signature with a consent box, like Edge8's agreements. */
export function SignForm({ version, sha256, consent, suggested }: { version: number; sha256: string; consent: string; suggested: string }) {
  const [state, action, pending] = useActionState(signConstitution, initial);
  const [name, setName] = useState(suggested);
  const [agree, setAgree] = useState(false);
  if (state.ok) return <p className="msg ok">Signed. Thank you, {name.split(" ")[0]}.</p>;
  return (
    <form action={action} className="esign">
      <input type="hidden" name="sha256" value={sha256} />
      <label className="esign-field">
        <span>Type your full name to sign version {version}</span>
        <input className="field" name="typed_name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={120} />
      </label>
      <div className="esign-preview" aria-hidden>{name || "Your signature"}</div>
      <label className="esign-consent">
        <input type="checkbox" name="consent" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>{consent}</span>
      </label>
      {state.error && <p className="msg err">{state.error}</p>}
      <button className="btn" type="submit" disabled={!agree || name.trim().length < 2 || pending}>
        {pending ? "Signing…" : "Sign the Constitution"}
      </button>
      <p className="note-line">We keep your typed name, the time, your IP address and browser, and the fingerprint of the text you signed.</p>
    </form>
  );
}
