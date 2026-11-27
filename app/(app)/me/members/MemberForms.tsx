"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAccess, setLeft, type FormState } from "./actions";
import s from "./members.module.css";

const START: FormState = { ok: false, error: null };

function Msg({ state }: { state: FormState }) {
  if (state.error) return <span className="msg err">{state.error}</span>;
  if (state.ok) return <span className="msg ok">Saved.</span>;
  return null;
}

export function AccessForm({
  id,
  date,
  founding,
  admin,
}: {
  id: string;
  date: string | null;
  founding: boolean;
  admin: boolean;
}) {
  const [state, action, pending] = useActionState(saveAccess, START);
  return (
    <form action={action} className={s.inline}>
      <input type="hidden" name="id" value={id} />
      <label className={s.check}>
        First forum
        <input className={`field ${s.date}`} type="date" name="date" defaultValue={date ?? ""} />
      </label>
      <label className={s.check}><input type="checkbox" name="founding" defaultChecked={founding} /> Founding</label>
      <label className={s.check}><input type="checkbox" name="admin" defaultChecked={admin} /> Admin</label>
      <button className="btn-ghost" type="submit" disabled={pending}>{pending ? "…" : "Save"}</button>
      <Msg state={state} />
    </form>
  );
}

export function LeaveForm({ id, name, left }: { id: string; name: string; left: boolean }) {
  const [state, action, pending] = useActionState(setLeft, START);
  return (
    <form
      action={action}
      className={s.inline}
      onSubmit={(e) => {
        if (!left && !confirm(`Remove ${name} from the forum? This ends all their access today.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      {left && <input type="hidden" name="restore" value="1" />}
      <button className={`btn-ghost ${left ? "" : s.danger}`} type="submit" disabled={pending}>
        {left ? "Restore access" : "Remove from forum"}
      </button>
      <Msg state={state} />
    </form>
  );
}

/** Invite by email (POST /api/admin/members, admin-only on the server). The date may stay unset. */
export function InviteForm() {
  const router = useRouter();
  const [msg, setMsg] = useState<FormState>(START);
  const [pending, setPending] = useState(false);
  return (
    <form
      className={s.add}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const date = String(f.get("date") ?? "");
        setPending(true);
        const res = await fetch("/api/admin/members", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: String(f.get("email") ?? "").trim(),
            full_name: String(f.get("name") ?? "").trim(),
            ...(date ? { forum_joined_on: date } : {}),
          }),
        }).catch(() => null);
        const data = res ? await res.json().catch(() => ({})) : {};
        setMsg(res?.ok ? { ok: true, error: null } : { ok: false, error: data.error || "Invite failed." });
        setPending(false);
        if (res?.ok) router.refresh();
      }}
    >
      <input className="field" name="name" placeholder="Full name" required />
      <input className="field" name="email" type="email" placeholder="Email" required />
      <label className={s.label}>
        First forum (leave empty if not set yet)
        <input className="field" name="date" type="date" />
      </label>
      <button className="btn" type="submit" disabled={pending}>{pending ? "…" : "Send invite"}</button>
      {msg.error && <span className="msg err">{msg.error}</span>}
      {msg.ok && <span className="msg ok">Invite sent.</span>}
    </form>
  );
}
