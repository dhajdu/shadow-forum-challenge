"use client";

import { useActionState } from "react";
import { addSeason, type SeasonFormState } from "./actions";
import s from "../members/members.module.css";

const START: SeasonFormState = { ok: false, error: null };

export function SeasonForm() {
  const [state, action, pending] = useActionState(addSeason, START);
  return (
    <form action={action} className={s.add}>
      <input className="field" name="name" placeholder="Name, e.g. Q1 2027" required />
      <label className={s.label}>Starts<input className="field" type="date" name="starts_on" required /></label>
      <label className={s.label}>Ends<input className="field" type="date" name="ends_on" required /></label>
      <label className={s.label}>
        Metric
        <select className="field" name="metric" defaultValue="blend">
          <option value="blend">WHOOP blend (recovery, sleep, strain)</option>
          <option value="recovery">Recovery %</option>
          <option value="strain">Strain</option>
        </select>
      </label>
      <button className="btn" type="submit" disabled={pending}>{pending ? "…" : "Create season"}</button>
      {state.error && <span className="msg err">{state.error}</span>}
      {state.ok && <span className="msg ok">Season created.</span>}
    </form>
  );
}
