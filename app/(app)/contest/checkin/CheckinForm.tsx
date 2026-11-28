"use client";

import { useActionState } from "react";
import { saveCheckin, type CheckinState } from "./actions";
import g from "../goalboard.module.css";

const START: CheckinState = { ok: false, error: null, gain: null };

export function CheckinForm({ label, unit, value, note }: { label: string; unit: string | null; value: number | null; note: string | null }) {
  const [state, action, pending] = useActionState(saveCheckin, START);
  return (
    <form action={action} className={g.form}>
      <label>
        <span>{label}{unit ? ` (${unit})` : ""}</span>
        <input className="field" name="value" type="number" step="any" inputMode="decimal" required defaultValue={value ?? undefined} />
      </label>
      <label>
        <span>Note</span>
        <textarea className="field" name="note" rows={2} maxLength={500} defaultValue={note ?? ""} placeholder="What moved it this week?" />
      </label>
      <button className="btn" type="submit" disabled={pending}>{pending ? "…" : "Save"}</button>
      {state.error && <span className="msg err">{state.error}</span>}
      {state.ok && state.gain && <span className={g.gain}>{state.gain}</span>}
    </form>
  );
}
