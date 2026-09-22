"use client";

import { useActionState } from "react";
import { createGoal, type GoalFormState } from "@/app/actions/goal";
import { coachNameFor } from "@/lib/roster";

const initial: GoalFormState = { error: null };

export function OnboardingForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(createGoal, initial);
  const coach = coachNameFor(name);

  return (
    <form action={formAction} className="onboard-form">
      <label>Your name</label>
      <input className="field" name="name" defaultValue={name} readOnly />

      <label>Your one Q4 business goal</label>
      <textarea
        className="field"
        name="title"
        required
        rows={2}
        placeholder='e.g. "Close 3 new enterprise clients by Dec 31"'
      />

      <div className="onboard-row">
        <div>
          <label>How you&apos;ll measure it</label>
          <input className="field" name="measure" placeholder="e.g. signed contracts" />
        </div>
        <div>
          <label>Target by</label>
          <input className="field" name="target_date" type="date" defaultValue="2026-12-31" />
        </div>
      </div>

      <label>Your coach for the monthly 1-on-1 (assigned)</label>
      <div className="field readonly">{coach ?? "Assigned once your roster is set"}</div>

      {state.error && <div className="msg err">{state.error}</div>}

      <button className="btn" type="submit" disabled={pending} style={{ marginTop: 12 }}>
        {pending ? "…" : "Lock it in & enter →"}
      </button>
      <p className="onboard-note">
        You can update <b>progress</b> later — but the goal itself is fixed once set. Miss it → 5M you + 5M coach.
      </p>
    </form>
  );
}
