"use client";

import { useActionState } from "react";
import { saveForumSettings, type ForumSettingsState } from "./actions";
import type { PublicForumSettings } from "@/lib/forum-config";
import s from "../members/members.module.css";

const START: ForumSettingsState = { ok: false, error: null };

export function ForumSettingsForm({ value, timeZones, whoopKeys }: { value: PublicForumSettings; timeZones: string[]; whoopKeys: boolean }) {
  const [state, action, pending] = useActionState(saveForumSettings, START);
  return (
    <form action={action} className={s.add}>
      <label className={s.label}>
        Forum name
        <input className="field" name="name" defaultValue={value.name} maxLength={80} required />
      </label>
      <label className={s.label}>
        Short name (notifications, calendar entries)
        <input className="field" name="short_name" defaultValue={value.shortName} maxLength={40} required />
      </label>
      <label className={s.label}>
        Organisation
        <select className="field" name="organisation" defaultValue={value.organisation}>
          <option value="EO">EO</option>
          <option value="YPO">YPO</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className={s.label}>
        Currency (three-letter code)
        <input className="field" name="currency" defaultValue={value.currency} maxLength={3} pattern="[A-Za-z]{3}" required />
      </label>
      <label className={s.label}>
        Dues per member per forum, in whole units
        <input className="field" name="dues_per_forum" type="number" min={0} step={1} defaultValue={value.duesPerForum} required />
      </label>
      <label className={s.label}>
        Time zone
        <select className="field" name="time_zone" defaultValue={value.timeZone}>
          {timeZones.map((tz) => (
            <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
          ))}
        </select>
      </label>
      <label className={s.label}>
        Site address
        <input className="field" name="site_url" type="url" defaultValue={value.siteUrl} required />
      </label>
      <label className={s.check}>
        <input type="checkbox" name="whoop_enabled" defaultChecked={value.whoopEnabled} /> WHOOP health track (Biometrics and the race)
      </label>
      {!whoopKeys && <span className="note-line">WHOOP keys are not set on this site, so members cannot connect WHOOP yet.</span>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "…" : "Save"}</button>
      {state.error && <span className="msg err">{state.error}</span>}
      {state.ok && <span className="msg ok">Saved.</span>}
    </form>
  );
}
