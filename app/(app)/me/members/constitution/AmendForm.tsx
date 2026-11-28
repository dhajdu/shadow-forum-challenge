"use client";

import { useActionState } from "react";
import { publishAmendment, type PublishState } from "@/app/(app)/forum/constitution/actions";

const initial: PublishState = { error: null, ok: false };

/** Admin: edit the Constitution and publish it as a new version that everyone signs again. */
export function AmendForm({ body, next }: { body: string; next: number }) {
  const [state, action, pending] = useActionState(publishAmendment, initial);
  if (state.ok) return <p className="msg ok">Version {state.version} is published. Every member is asked to sign it again.</p>;
  return (
    <form action={action} className="esign">
      <label className="esign-field">
        <span>What the amendment changes (members read this first)</span>
        <textarea className="field" name="change_note" rows={3} required maxLength={2000} placeholder="e.g. Breaks are now fined 200,000 VND, not 500,000." />
      </label>
      <label className="esign-field">
        <span>The Constitution, as amended</span>
        <textarea className="field" name="body_md" rows={24} defaultValue={body} required />
      </label>
      {state.error && <p className="msg err">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Publishing…" : `Publish version ${next} and ask everyone to sign`}</button>
    </form>
  );
}
