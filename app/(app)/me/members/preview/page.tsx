import Link from "next/link";
import { notFound } from "next/navigation";
import { getForumContext } from "@/app/_data/context";
import { getMember, listMembers, previewAs } from "@/app/_data/forum";
import { longDay, shortDay } from "@/app/_data/format";
import s from "../members.module.css";

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const { as } = await searchParams;
  const { db, viewer, today } = await getForumContext();
  if (!viewer.is_admin) notFound();
  const members = await listMembers(db, viewer);
  const member = as ? await getMember(db, viewer, as) : null;
  const view = member ? await previewAs(db, viewer, member, today) : null;
  const first = member?.full_name.split(/\s+/)[0];

  return (
    <main className="page">
      <Link href="/me/members" className="back">← Members and access</Link>
      <header className="page-head">
        <div className="eyebrow">Admin</div>
        <h1>{member ? `Preview as ${member.full_name}` : "Preview as member"}</h1>
        <p className="sub">
          Read-only. It runs the access rule with the member&apos;s first-forum date
          {member?.forum_joined_on ? ` (${longDay(member.forum_joined_on)})` : ""}. Nothing here is sent to them.
        </p>
      </header>

      <form className={`${s.inline} ${s.pick}`} method="get">
        <select className={`field ${s.date}`} name="as" defaultValue={member?.id ?? ""} aria-label="Member">
          <option value="" disabled>Choose a member</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.full_name}</option>
          ))}
        </select>
        <button className="btn-ghost" type="submit">Preview</button>
      </form>

      {member && !view && (
        <section className="zone-card">
          <p className="msg err">The preview could not run: the admin preview function is not in the database yet.</p>
        </section>
      )}

      {member && view && (
        <div className={s.grid}>
          <div className={s.list}>
            <section className="zone-card">
              <h2>Forum · agendas</h2>
              {view.meetings.length === 0 ? (
                <p className="note-line">No forums visible{member.forum_joined_on ? "" : ": no first-forum date set"}.</p>
              ) : (
                <ul className="rows">
                  {view.meetings.map((m) => (
                    <li key={m.id} className="row">
                      <span className="row-when">{shortDay(m.held_on)}</span>
                      <span className="row-main"><b>{m.title}</b></span>
                      {m.status === "planned" && <span className="tag planned">planned</span>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="note-line">
                {view.meetings.length} meeting{view.meetings.length === 1 ? "" : "s"} visible ·{" "}
                <span className={view.beforeJoin === 0 ? s.ok : s.bad}>
                  {view.beforeJoin} before {member.forum_joined_on ? shortDay(member.forum_joined_on) : "their first forum"}
                </span>
              </p>
            </section>
            <section className="zone-card">
              <h2>Library</h2>
              {view.library.length === 0 ? (
                <p className="note-line">Nothing visible.</p>
              ) : (
                <ul className="rows">
                  {view.library.map((d) => (
                    <li key={d.slug} className="row">
                      <span className="row-main"><b>{d.title}</b></span>
                      {d.audience === "founding" && <span className="tag founding">founding</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <div className={s.list}>
            <section className="zone-card">
              <h2>Contest seasons</h2>
              <p className="note-line">
                {view.seasons.length ? view.seasons.map((x) => x.name).join(", ") : "None yet. Earlier seasons are hidden."}
              </p>
            </section>
            <section className="zone-card">
              <h2>Home</h2>
              <p className="note-line">
                {view.upcoming[0]
                  ? `${view.upcoming[0].held_on === member.forum_joined_on ? "Your first forum" : "Next forum"}: ${longDay(view.upcoming[0].held_on)}`
                  : "Next forum: not set yet"}
              </p>
            </section>
            <section className="zone-card">
              <h2>Checklist for {first}</h2>
              <ul className={s.checklist}>
                <li>{member.forum_joined_on ? <span className={s.ok}>✓</span> : "☐"} First-forum date set</li>
                <li><span className={view.beforeJoin === 0 ? s.ok : s.bad}>{view.beforeJoin === 0 ? "✓" : "✗"}</span> Nothing before their first forum</li>
                <li>☐ Lark: only the space from their first forum</li>
                <li>☐ Invite sent</li>
              </ul>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
