import Link from "next/link";
import { notFound } from "next/navigation";
import { getForumContext } from "@/app/_data/context";
import { listMembers } from "@/app/_data/forum";
import { AccessForm, InviteForm, LeaveForm } from "./MemberForms";
import s from "./members.module.css";

export default async function MembersPage() {
  const { db, viewer } = await getForumContext();
  if (!viewer.is_admin) notFound();
  const members = await listMembers(db, viewer);

  return (
    <main className="page">
      <header className="page-head">
        <div className="eyebrow">Admin</div>
        <h1>Members and access</h1>
        <p className="sub">One date per member is the whole access setup: they see forums, agendas and contest seasons from their first forum on.</p>
        <nav className="actions-row">
          <Link href="/me/seasons" className="btn-ghost inline">Seasons</Link>
        </nav>
      </header>

      <div className={s.grid}>
        <section className="zone-card">
          <h2>Members</h2>
          <ul className={s.list}>
            {members.map((m) => (
              <li key={m.id} className={s.member}>
                <div className={s.top}>
                  <b>{m.full_name}</b>
                  {m.is_founding && <span className="tag founding">founding</span>}
                  {m.is_admin && <span className="tag admin">admin</span>}
                  {m.status === "waiting" && <span className="tag planned">no date yet</span>}
                  {m.status === "left" && <span className="tag left">left</span>}
                  <Link href={`/me/members/preview?as=${encodeURIComponent(m.id)}`} className="btn-ghost">Preview</Link>
                </div>
                {m.email && <span className="note-line">{m.email}</span>}
                {!m.forum_joined_on && m.first_forum_label && (
                  <span className="note-line">First forum: {m.first_forum_label}, date not set</span>
                )}
                <AccessForm id={m.id} date={m.forum_joined_on} founding={m.is_founding} admin={m.is_admin} />
                {m.id !== viewer.id && <LeaveForm id={m.id} name={m.full_name} left={m.status === "left"} />}
              </li>
            ))}
          </ul>
        </section>

        <div className={s.list}>
          <section className="zone-card">
            <h2>Add a member</h2>
            <InviteForm />
            <p className="note-line">
              They get an email to set a password. Until they have a first-forum date they see nothing. Set it, then check it with Preview.
            </p>
          </section>
          <section className="zone-card">
            <h2>Lark checklist</h2>
            <p className="note-line">Lark access is per space, not per date, so it stays a manual step.</p>
            <ul className={s.checklist}>
              <li>☐ Add each new member only to the space that starts at their first forum (for 23 Dec: &ldquo;2026/12 Forum&rdquo;)</li>
              <li>☐ Never add a new member to an older space</li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
