"use client";

import { useActionState } from "react";
import { createGoal, type GoalFormState } from "@/app/actions/goal";

const initial: GoalFormState = { error: null };

// seasonName, endsOn and stake come from today's season row (its name, last day and missed-goal stakes).
export function OnboardingForm({
  name,
  coach,
  seasonName,
  endsOn,
  stake,
}: {
  name: string;
  coach: string | null;
  seasonName: string;
  endsOn: string | null;
  stake: string | null;
}) {
  const [state, formAction, pending] = useActionState(createGoal, initial);

  return (
    <form action={formAction} className="onboard-form">
      <label>Your name</label>
      <input className="field" name="name" defaultValue={name} readOnly />

      <label>Your one {seasonName.split(" ")[0]} business goal</label>
      <textarea
        className="field"
        name="title"
        required
        rows={2}
        placeholder='e.g. "Close 3 new enterprise clients"'
      />

      <div className="onboard-row">
        <div>
          <label>Target number</label>
          <input className="field" name="target_value" type="number" step="any" placeholder="e.g. 3" />
        </div>
        <div>
          <label>Unit of measure</label>
          <input className="field" name="unit" placeholder="e.g. deals" />
        </div>
      </div>
      <label>Target by</label>
      <input className="field" name="target_date" type="date" defaultValue={endsOn ?? undefined} />

      <label>Your coach for the monthly 1-on-1 (assigned)</label>
      <div className="field readonly">{coach ?? "Assigned once your roster is set"}</div>

      {state.error && <div className="msg err">{state.error}</div>}

      <button className="btn" type="submit" disabled={pending} style={{ marginTop: 12 }}>
        {pending ? "…" : "Lock it in & enter →"}
      </button>
      <p className="onboard-note">
        You can update <b>progress</b> later — but the goal itself is fixed once set.{stake ? ` Miss it → ${stake}.` : ""}
      </p>
    </form>
  );
}
