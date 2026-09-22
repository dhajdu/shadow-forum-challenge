"use client";

import { useActionState, useState } from "react";
import { updateProgress, type ProgressState } from "@/app/actions/progress";
import type { GoalStatus } from "@/lib/database.types";

const initial: ProgressState = { error: null, ok: false };

const STATUS_LABELS: Record<GoalStatus, string> = {
  on_track: "On track",
  at_risk: "At risk",
  behind: "Behind",
  hit: "Hit ✓",
};

export function GoalProgress({
  title,
  currentProgress,
  currentStatus,
}: {
  title: string;
  currentProgress: number;
  currentStatus: GoalStatus;
}) {
  const [state, formAction, pending] = useActionState(updateProgress, initial);
  const [progress, setProgress] = useState(currentProgress);
  const [status, setStatus] = useState<GoalStatus>(currentStatus);

  return (
    <form action={formAction} className="goalprog">
      <p className="goal-title">{title}</p>

      <label>
        Progress: <b>{progress}%</b>
      </label>
      <input
        type="range"
        name="progress"
        min={0}
        max={100}
        value={progress}
        onChange={(e) => setProgress(Number(e.target.value))}
      />

      <label>Status this month</label>
      <div className="seg">
        {(Object.keys(STATUS_LABELS) as GoalStatus[]).map((s) => (
          <button
            type="button"
            key={s}
            className={`seg-btn ${status === s ? "on" : ""}`}
            onClick={() => setStatus(s)}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      <input type="hidden" name="status" value={status} />

      <label>Update note (goes to your coach)</label>
      <textarea className="field" name="note" rows={2} placeholder="Type an update…" />

      {state.error && <div className="msg err">{state.error}</div>}
      {state.ok && <div className="msg ok">Saved.</div>}

      <button className="btn" type="submit" disabled={pending} style={{ marginTop: 10 }}>
        {pending ? "…" : "Save progress"}
      </button>
    </form>
  );
}
