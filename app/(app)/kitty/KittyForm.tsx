"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addEntry, type KittyState } from "./actions";
import { vndShort } from "@/app/_data/kitty";
import s from "./kitty.module.css";

const initial: KittyState = { error: null, ok: false };

/** Add a line to the kitty: money in (dues, penalties) or out (spend). */
export function KittyForm({
  me,
  dues,
  today,
  people,
  forums,
  defaultForum,
}: {
  me: string;
  dues: number;
  today: string;
  people: { id: string; name: string }[];
  forums: { id: string; label: string; held_on: string }[];
  defaultForum: string | null;
}) {
  const [state, action, pending] = useActionState(addEntry, initial);
  const [dir, setDir] = useState<"in" | "out">("in");
  const [category, setCategory] = useState("dues");
  const [amount, setAmount] = useState(vndShort(dues));
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      form.current?.reset();
      setAmount(dir === "in" ? vndShort(dues) : "");
    }
  }, [state, dir, dues]);

  function pick(d: "in" | "out") {
    setDir(d);
    setCategory(d === "in" ? "dues" : "spend");
    setAmount(d === "in" ? vndShort(dues) : "");
  }

  return (
    <form ref={form} action={action} className={s.form}>
      <input type="hidden" name="direction" value={dir} />
      <div className={`seg ${s.dir}`} role="group" aria-label="Money in or out">
        <button type="button" className={`seg-btn ${dir === "in" ? "on" : ""}`} onClick={() => pick("in")}>Money in</button>
        <button type="button" className={`seg-btn ${dir === "out" ? "on" : ""}`} onClick={() => pick("out")}>Money out</button>
      </div>

      <label className={s.amount}>
        <span>Amount (VND)</span>
        <input className="field" name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2.5M" required />
      </label>
      <label>
        <span>What for</span>
        <select className="field" name="category" value={category} onChange={(e) => {
          setCategory(e.target.value);
          if (e.target.value === "dues") setAmount(vndShort(dues));
        }}>
          {dir === "in" ? (
            <>
              <option value="dues">Forum dues</option>
              <option value="penalty">Contest penalty</option>
              <option value="other">Other</option>
            </>
          ) : (
            <>
              <option value="spend">Spend</option>
              <option value="other">Other</option>
            </>
          )}
        </select>
      </label>
      <label>
        <span>{dir === "in" ? "Paid by" : "Paid to / spent by"}</span>
        <select className="field" name="member_id" defaultValue={dir === "in" ? me : ""} key={dir}>
          <option value="">{dir === "in" ? "—" : "Not a member (venue, shop…)"}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Forum</span>
        <select className="field" name="meeting_id" defaultValue={defaultForum ?? ""}>
          <option value="">Not for a forum</option>
          {forums.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Date</span>
        <input className="field" type="date" name="entry_on" defaultValue={today} max={today} />
      </label>
      <label className={s.note}>
        <span>Note{dir === "out" ? "" : " (optional)"}</span>
        <input className="field" name="note" maxLength={500} placeholder={dir === "out" ? "e.g. Dreamplex room, 23 Dec" : "e.g. paid Vinh in cash"} required={dir === "out"} />
      </label>

      {state.error && <p className={`msg err ${s.full}`}>{state.error}</p>}
      {state.ok && <p className={`msg ok ${s.full}`}>Added to the ledger.</p>}
      <button className={`btn ${s.full}`} type="submit" disabled={pending}>
        {pending ? "Saving…" : dir === "in" ? "Add money in" : "Add money out"}
      </button>
    </form>
  );
}
