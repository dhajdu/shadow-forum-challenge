import type { SupabaseClient } from "@supabase/supabase-js";
import { getForumContext } from "@/app/_data/context";
import { listMeetings } from "@/app/_data/forum";
import { longDay, shortDay } from "@/app/_data/format";
import { CATEGORY_LABEL, getKitty, vndFull, vndShort } from "@/app/_data/kitty";
import { PageBanner } from "@/components/PageBanner";
import { KittyForm } from "./KittyForm";
import { voidEntry } from "./actions";
import s from "./kitty.module.css";

const LARK = " (Lark Expense Sheet)"; // lines imported from Lark on 28 Nov 2026

type Person = { id: string; full_name: string; is_founding: boolean; forum_joined_on: string | null; forum_left_on: string | null };

// Kitty: the forum's shared money. Balance, who holds it, dues per forum, and the ledger anyone can add to.
export default async function KittyPage() {
  const { db, user, viewer, today } = await getForumContext();
  const [kitty, meetings, { data: ppl }] = await Promise.all([
    getKitty(db),
    listMeetings(db, viewer),
    (db as unknown as SupabaseClient).from("profiles").select("id, full_name, is_founding, forum_joined_on, forum_left_on").order("full_name"),
  ]);
  const people = (ppl ?? []) as Person[];
  const name = (id: string | null) => people.find((p) => p.id === id)?.full_name ?? "A member";
  const first = (id: string | null) => name(id).split(/\s+/)[0];
  const active = people.filter((p) => !p.forum_left_on || p.forum_left_on > today);

  // dues: the latest forum that has happened (or is today), and who has paid for it
  const forum = meetings.find((m) => m.held_on <= today) ?? null;
  const members = forum ? active.filter((p) => p.is_founding || (p.forum_joined_on != null && p.forum_joined_on <= forum.held_on)) : [];
  const paid = new Set(
    kitty.entries.filter((e) => !e.voided_at && e.category === "dues" && e.meeting_id === forum?.id && e.member_id).map((e) => e.member_id!)
  );
  const forums = meetings
    .filter((m) => m.held_on <= today || m === [...meetings].reverse().find((x) => x.held_on > today))
    .slice(0, 6)
    .map((m) => ({ id: m.id, held_on: m.held_on, label: `${shortDay(m.held_on)} · ${m.title}` }));
  const meetingLabel = (id: string | null) => {
    const m = meetings.find((x) => x.id === id);
    return m ? `${shortDay(m.held_on)} forum` : null;
  };

  const live = kitty.entries.filter((e) => !e.voided_at);
  const inTotal = live.filter((e) => e.direction === "in").reduce((a, e) => a + e.amount_vnd, 0);
  const outTotal = live.filter((e) => e.direction === "out").reduce((a, e) => a + e.amount_vnd, 0);
  // the sheet: oldest first with a running balance; lines before a member's first forum are carried in as one figure
  const broughtForward = (kitty.balance ?? 0) - (inTotal - outTotal);
  let running = broughtForward;
  const rows = [...kitty.entries].reverse().map((e) => {
    if (!e.voided_at) running += e.direction === "in" ? e.amount_vnd : -e.amount_vnd;
    return { e, balance: running };
  });

  return (
    <>
      <PageBanner src="/banners/kitty.webp" position="50% 60%">
        <h1>Kitty</h1>
      </PageBanner>
      <main className="page">
        <section className={s.top}>
          <div className={s.balance}>
            <span className={s.label}>In the kitty</span>
            <b>{kitty.balance == null ? "—" : `${vndShort(kitty.balance)} ₫`}</b>
            <small>{kitty.balance == null ? "" : vndFull(kitty.balance)}</small>
            <p className={s.holder}>
              {kitty.treasurerId ? (
                <>Held by <strong>{name(kitty.treasurerId)}</strong>, treasurer</>
              ) : (
                "No treasurer set"
              )}
              {" · "}dues {vndShort(kitty.dues)} each per forum
            </p>
          </div>

          {forum && members.length > 0 && (
            <div className={s.dues}>
              <span className={s.label}>Dues · {longDay(forum.held_on)} forum</span>
              <ul className={s.chips}>
                {members.map((p) => (
                  <li key={p.id} className={paid.has(p.id) ? s.paid : s.owed}>
                    <span aria-hidden>{paid.has(p.id) ? "✓" : "·"}</span> {p.full_name.split(/\s+/)[0]}
                  </li>
                ))}
              </ul>
              <p className="note-line">
                {paid.size >= members.length
                  ? "Everyone has paid for this forum."
                  : `${members.length - paid.size} of ${members.length} still to pay. Paid ${kitty.treasurerId ? first(kitty.treasurerId) : "the treasurer"}? Add it below.`}
              </p>
            </div>
          )}
        </section>

        <section className={s.sheetWrap} aria-label="Ledger">
          <div className={s.ledgerHead}>
            <h2 className={s.label}>Ledger</h2>
            <span className="note-line">
              {live.length} line{live.length === 1 ? "" : "s"} · in {vndShort(inTotal)} · out {vndShort(outTotal)}
            </span>
            <a href="#add" className="btn inline">Add a line</a>
          </div>
          {rows.length === 0 ? (
            <p className="note-line">No lines yet. Add the first payment to start the ledger.</p>
          ) : (
            <div className={s.scroller}>
              <table className={s.sheet}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Who</th>
                    <th className={s.num}>In</th>
                    <th className={s.num}>Out</th>
                    <th className={s.num}>Balance</th>
                    <th aria-label="Void" />
                  </tr>
                </thead>
                <tbody>
                  {broughtForward !== 0 && (
                    <tr className={s.bf}>
                      <td />
                      <td colSpan={5}>Brought forward from before your first forum</td>
                      <td className={s.num}>{vndFull(broughtForward).replace(" VND", "")}</td>
                      <td />
                    </tr>
                  )}
                  {rows.map(({ e, balance }) => (
                    <tr key={e.id} className={e.voided_at ? s.voided : ""}>
                      <td className={s.date}>{longDay(e.entry_on)}</td>
                      <td><span className={`${s.cat} ${e.direction === "in" ? s.catIn : s.catOut}`}>{CATEGORY_LABEL[e.category]}</span></td>
                      <td className={s.desc}>
                        {[meetingLabel(e.meeting_id), e.note?.replace(LARK, "")].filter(Boolean).join(" · ") || "—"}
                        <small>
                          {e.note?.includes(LARK) ? "from the Lark Expense Sheet" : `added by ${first(e.created_by)}`}
                          {e.voided_at ? ` · voided by ${first(e.voided_by)}` : ""}
                        </small>
                      </td>
                      <td>{e.member_id ? name(e.member_id) : ""}</td>
                      <td className={`${s.num} ${s.in}`}>{e.direction === "in" ? e.amount_vnd.toLocaleString("en-US") : ""}</td>
                      <td className={`${s.num} ${s.out}`}>{e.direction === "out" ? `−${e.amount_vnd.toLocaleString("en-US")}` : ""}</td>
                      <td className={`${s.num} ${s.bal}`}>{e.voided_at ? "" : balance.toLocaleString("en-US")}</td>
                      <td>
                        {!e.voided_at && (
                          <form action={voidEntry}>
                            <input type="hidden" name="id" value={e.id} />
                            <button className={s.void} type="submit" aria-label={`Void ${CATEGORY_LABEL[e.category]} ${vndShort(e.amount_vnd)}`}>Void</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>Total</td>
                    <td className={`${s.num} ${s.in}`}>{inTotal.toLocaleString("en-US")}</td>
                    <td className={`${s.num} ${s.out}`}>−{outTotal.toLocaleString("en-US")}</td>
                    <td className={`${s.num} ${s.bal}`}>{(kitty.balance ?? 0).toLocaleString("en-US")}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section className={`zone-card ${s.add}`} id="add">
          <h2>Add to the ledger</h2>
          <KittyForm
            me={user.id}
            dues={kitty.dues}
            today={today}
            people={active.map((p) => ({ id: p.id, name: p.full_name }))}
            forums={forums}
            defaultForum={forum?.id ?? null}
          />
          <p className="note-line">Any member can add or void a line. Nothing is deleted: voided lines stay, struck through, with who voided them.</p>
        </section>
      </main>
    </>
  );
}
