import type { SupabaseClient } from "@supabase/supabase-js";
import { getForumContext } from "@/app/_data/context";
import { consentText, getConstitution } from "@/app/_data/constitution";
import { longDay } from "@/app/_data/format";
import { Markdown } from "@/components/Markdown";
import { SignForm } from "./SignForm";
import s from "./constitution.module.css";

type Person = { id: string; full_name: string; is_founding: boolean; forum_joined_on: string | null; forum_left_on: string | null };

const day = (iso: string) => longDay(iso.slice(0, 10));

/** The signed Constitution: current version, who has signed it, and the e-sign form. Null if none is published yet. */
export async function ConstitutionView() {
  const { db, user, viewer, today } = await getForumContext();
  const [{ current, versions, signatures }, { data: ppl }] = await Promise.all([
    getConstitution(db),
    (db as unknown as SupabaseClient).from("profiles").select("id, full_name, is_founding, forum_joined_on, forum_left_on").order("full_name"),
  ]);
  if (!current) return null;

  // every member signs, including those whose first forum is still to come (as member_is_active);
  // members who left or have no first forum date yet don't
  const members = ((ppl ?? []) as Person[]).filter(
    (p) => (p.is_founding || p.forum_joined_on != null) && (!p.forum_left_on || p.forum_left_on > today)
  );
  const signedNow = new Map(signatures.filter((x) => x.version_id === current.id).map((x) => [x.user_id, x]));
  const mine = signedNow.get(user.id);
  const myEarlier = !mine ? signatures.filter((x) => x.user_id === user.id).pop() : undefined;
  const earlierVersion = myEarlier ? versions.find((v) => v.id === myEarlier.version_id)?.version : undefined;
  const done = members.filter((m) => signedNow.has(m.id)).length;

  return (
    <article className={s.wrap}>
      <header className={s.head}>
        <div className="eyebrow">Version {current.version} · in force since {day(current.published_at)}</div>
        <h2>Approved Constitution</h2>
        <p className={s.count}>
          <b>{done} of {members.length}</b> members have signed version {current.version}
        </p>
      </header>

      {!mine && (
        <a href="#sign" className={s.nudge}>
          {earlierVersion
            ? `You signed version ${earlierVersion}. The Constitution was amended: read what changed and sign version ${current.version}.`
            : `You haven't signed the Constitution yet. Read it, then sign at the bottom.`}
          <span aria-hidden> ↓</span>
        </a>
      )}

      {current.version > 1 && current.change_note && (
        <aside className={s.change}>
          <b>What changed in version {current.version}</b>
          <p>{current.change_note}</p>
        </aside>
      )}

      <Markdown text={current.body_md} title="Approved Constitution" />

      <section className={s.signatures} aria-label="Signatures">
        <h3 className={s.label}>Signatures · version {current.version}</h3>
        <ul>
          {members.map((m) => {
            const sig = signedNow.get(m.id);
            return (
              <li key={m.id} className={sig ? s.signed : s.waiting}>
                <span className={s.who}>{m.full_name}</span>
                {sig ? (
                  <>
                    <span className={s.script}>{sig.typed_name}</span>
                    <span className={s.when}>{day(sig.signed_at)}</span>
                  </>
                ) : (
                  <span className={s.when}>Waiting</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section id="sign" className={s.sign}>
        {mine ? (
          <p className={s.done}>
            You signed version {current.version} on {day(mine.signed_at)} as <span className={s.script}>{mine.typed_name}</span>
          </p>
        ) : (
          <SignForm version={current.version} sha256={current.sha256} consent={consentText(current.version)} suggested={viewer.full_name} />
        )}
      </section>

      {versions.length > 1 && (
        <details className={s.history}>
          <summary>Earlier versions</summary>
          <ul>
            {versions.slice(1).map((v) => (
              <li key={v.id}>
                <b>Version {v.version}</b> · {day(v.published_at)} · {signatures.filter((x) => x.version_id === v.id).length} signed
                {v.change_note && <small>{v.change_note}</small>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
