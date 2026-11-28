"use client";

import { useActionState } from "react";
import { addSeason, updateSeasonRules, type SeasonFormState } from "./actions";
import { CHECKIN_RHYTHMS, type ContestRules } from "@/lib/goal-points";
import { moneyShort } from "@/app/_data/kitty";
import s from "../members/members.module.css";
import g from "../../contest/goalboard.module.css";

const START: SeasonFormState = { ok: false, error: null };

export function SeasonForm({ whoopEnabled }: { whoopEnabled: boolean }) {
  const [state, action, pending] = useActionState(addSeason, START);
  return (
    <form action={action} className={s.add}>
      <input className="field" name="name" placeholder="Name, e.g. Q1 2027" required />
      <label className={s.label}>Starts<input className="field" type="date" name="starts_on" required /></label>
      <label className={s.label}>Ends<input className="field" type="date" name="ends_on" required /></label>
      <label className={s.label}>
        Contest name
        <input className="field" name="contest_name" placeholder="e.g. Race to the retreat" maxLength={60} />
      </label>
      <label className={s.label}>
        Scored on
        <select className="field" name="scoring" defaultValue="goals">
          <option value="goals">Goal check-ins</option>
          {whoopEnabled && <option value="both">Goal check-ins and WHOOP</option>}
          {whoopEnabled && <option value="whoop">WHOOP only</option>}
        </select>
      </label>
      {whoopEnabled && (
        <label className={s.label}>
          WHOOP metric
          <select className="field" name="metric" defaultValue="blend">
            <option value="blend">WHOOP blend (recovery, sleep, strain)</option>
            <option value="recovery">Recovery %</option>
            <option value="strain">Strain</option>
          </select>
        </label>
      )}
      <button className="btn" type="submit" disabled={pending}>{pending ? "…" : "Create season"}</button>
      {state.error && <span className="msg err">{state.error}</span>}
      {state.ok && <span className="msg ok">Season created. Set its rules on the left.</span>}
    </form>
  );
}

/** One season's contest rules: name, scoring, rhythm, points and stakes (amounts in the forum's currency). */
export function RulesForm({ id, rules, currency, whoopEnabled }: { id: string; rules: ContestRules; currency: string; whoopEnabled: boolean }) {
  const [state, action, pending] = useActionState(updateSeasonRules, START);
  const amt = (n: number | null) => (n == null ? "" : moneyShort(n, currency));
  return (
    <form action={action} className={g.rules}>
      <input type="hidden" name="id" value={id} />
      <label className={g.wide}>
        <span>Contest name</span>
        <input className="field" name="contest_name" defaultValue={rules.contestName ?? ""} placeholder="e.g. Race to the retreat" maxLength={60} />
      </label>
      <label>
        <span>Scored on</span>
        <select className="field" name="scoring" defaultValue={rules.scoring ?? "none"}>
          <option value="none">No contest yet</option>
          <option value="goals">Goal check-ins</option>
          {(whoopEnabled || rules.scoring === "both") && <option value="both">Goal check-ins and WHOOP</option>}
          {(whoopEnabled || rules.scoring === "whoop") && <option value="whoop">WHOOP only</option>}
        </select>
      </label>
      <label>
        <span>Check-ins</span>
        <select className="field" name="checkin_days" defaultValue={rules.checkinDays}>
          {CHECKIN_RHYTHMS.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
        </select>
      </label>
      <label>
        <span>Points per check-in</span>
        <input className="field" name="points_checkin" type="number" min={0} max={1000} step={1} defaultValue={rules.pointsCheckin} />
      </label>
      <label>
        <span>Progress, up to</span>
        <input className="field" name="points_progress" type="number" min={0} max={1000} step={1} defaultValue={rules.pointsProgress} />
      </label>
      <label>
        <span>Streak bonus</span>
        <input className="field" name="points_streak" type="number" min={0} max={1000} step={1} defaultValue={rules.pointsStreak} />
      </label>
      <label>
        <span>Goal hit</span>
        <input className="field" name="points_goal" type="number" min={0} max={10000} step={1} defaultValue={rules.pointsGoal} />
      </label>
      <label>
        <span>Missed check-in fine ({currency})</span>
        <input className="field" name="missed_checkin_fine" defaultValue={amt(rules.missedCheckinFine)} placeholder="Off" />
      </label>
      <label>
        <span>Missed goal: rider ({currency})</span>
        <input className="field" name="missed_goal_fine" defaultValue={amt(rules.missedGoalFine)} placeholder="None" />
      </label>
      <label>
        <span>Missed goal: coach ({currency})</span>
        <input className="field" name="coach_share_fine" defaultValue={amt(rules.coachShareFine)} placeholder="None" />
      </label>
      <label className={g.wide}>
        <span>Placement stakes from 1st place ({currency})</span>
        <input className="field" name="ladder" defaultValue={rules.ladder.map((n) => (n === 0 ? "0" : moneyShort(n, currency))).join(", ")} placeholder="e.g. 0, 2M, 3M, 4M, 5M (blank: none)" />
      </label>
      <button className="btn-ghost" type="submit" disabled={pending}>{pending ? "…" : "Save rules"}</button>
      {state.error && <span className={`msg err ${g.wide}`}>{state.error}</span>}
      {state.ok && <span className={`msg ok ${g.wide}`}>Rules saved.</span>}
    </form>
  );
}
