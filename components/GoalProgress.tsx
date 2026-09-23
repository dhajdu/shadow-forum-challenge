"use client";

import { useActionState, useState } from "react";
import { updateGoalMeasure, type ProgressState } from "@/app/actions/progress";
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
  unit,
  targetValue,
  currentValue,
  currentStatus,
}: {
  title: string;
  unit: string | null;
  targetValue: number | null;
  currentValue: number;
  currentStatus: GoalStatus;
}) {
  const [state, formAction, pending] = useActionState(updateGoalMeasure, initial);
  const [current, setCurrent] = useState(String(currentValue ?? 0));
  const [target, setTarget] = useState(targetValue != null ? String(targetValue) : "");
  const [unitVal, setUnitVal] = useState(unit ?? "");
  const [status, setStatus] = useState<GoalStatus>(currentStatus);

  const t = Number(target);
  const c = Number(current);
  const pct = t > 0 && !Number.isNaN(c) ? Math.max(0, Math.min(100, Math.round((c / t) * 100))) : 0;

  return (
    <form action={formAction} className="goalprog">
      <p className="goal-title">{title}</p>

      <div className="measure-row">
        <label>
          Current
          <input className="field" name="current_value" type="number" step="any" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <span className="slash">/</span>
        <label>
          Target
          <input className="field" name="target_value" type="number" step="any" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 3" />
        </label>
        <label>
          Unit
          <input className="field" name="unit" value={unitVal} onChange={(e) => setUnitVal(e.target.value)} placeholder="e.g. deals" />
        </label>
      </div>

      <div className="pct-line">
        {c || 0}{unitVal ? ` ${unitVal}` : ""}{t > 0 ? ` of ${t}${unitVal ? ` ${unitVal}` : ""}` : ""} · <b>{pct}%</b>
      </div>
      <div className="prog"><i style={{ width: `${pct}%` }} /></div>

      <label className="statlbl">Status this month</label>
      <div className="seg">
        {(Object.keys(STATUS_LABELS) as GoalStatus[]).map((s) => (
          <button type="button" key={s} className={`seg-btn ${status === s ? "on" : ""}`} onClick={() => setStatus(s)}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      <input type="hidden" name="status" value={status} />

      <label className="statlbl">Update note (goes to your coach)</label>
      <textarea className="field" name="note" rows={2} placeholder="Type an update…" />

      {state.error && <div className="msg err">{state.error}</div>}
      {state.ok && <div className="msg ok">Saved.</div>}

      <button className="btn" type="submit" disabled={pending} style={{ marginTop: 10 }}>
        {pending ? "…" : "Save progress"}
      </button>
    </form>
  );
}
