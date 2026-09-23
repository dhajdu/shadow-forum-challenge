"use client";

import { addPersonalGoal, updatePersonalGoal, deletePersonalGoal } from "@/app/actions/personal";

export type PersonalGoal = {
  id: string;
  title: string;
  unit: string | null;
  target_value: number | null;
  current_value: number;
};

function pct(current: number, target: number | null) {
  if (!target || target <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

export function ExtraCredit({ goals }: { goals: PersonalGoal[] }) {
  return (
    <div className="xc">
      <p className="xc-note">Personal goals — just for you. These don&apos;t count toward the contest.</p>

      {goals.length > 0 && (
        <ul className="xc-list">
          {goals.map((g) => {
            const p = pct(g.current_value, g.target_value);
            return (
              <li key={g.id} className="xc-item">
                <div className="xc-info">
                  <span className="xc-title">{g.title}</span>
                  <span className="xc-sub">
                    {g.current_value}
                    {g.unit ? ` ${g.unit}` : ""}
                    {g.target_value != null ? ` of ${g.target_value}${g.unit ? ` ${g.unit}` : ""}` : ""}
                    {p != null ? ` · ${p}%` : ""}
                  </span>
                  {p != null && <div className="prog sm"><i style={{ width: `${p}%` }} /></div>}
                </div>
                <form action={updatePersonalGoal} className="xc-upd">
                  <input type="hidden" name="id" value={g.id} />
                  <input className="field" name="current_value" type="number" step="any" defaultValue={g.current_value} aria-label="Current" />
                  <button className="seg-btn" type="submit">Save</button>
                </form>
                <form action={deletePersonalGoal}>
                  <input type="hidden" name="id" value={g.id} />
                  <button className="xc-del" type="submit" aria-label="Delete">✕</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <form action={addPersonalGoal} className="xc-add">
        <input className="field" name="title" placeholder="New personal goal" required />
        <input className="field xc-num" name="target_value" type="number" step="any" placeholder="Target" />
        <input className="field xc-num" name="unit" placeholder="Unit" />
        <button className="btn xc-addbtn" type="submit">Add</button>
      </form>
    </div>
  );
}
