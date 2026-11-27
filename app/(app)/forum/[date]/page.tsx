import Link from "next/link";
import { notFound } from "next/navigation";
import { getForumContext } from "@/app/_data/context";
import { getMeeting } from "@/app/_data/forum";
import { timeOf, weekdayDay } from "@/app/_data/format";
import { Markdown } from "@/components/Markdown";
import s from "../forum.module.css";

export default async function AgendaPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  // a date (web links) or a meeting id (push deep links)
  if (!/^(\d{4}-\d{2}-\d{2}|[0-9a-f-]{36})$/i.test(date)) notFound();
  const { db, viewer } = await getForumContext();
  // not visible and not there look the same: 404, with no hint either way
  const m = await getMeeting(db, viewer, date);
  if (!m) notFound();

  const when = [weekdayDay(m.held_on) + " " + m.held_on.slice(0, 4), m.starts_at && timeOf(m.starts_at), m.place]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Link href="/forum" className="back">‹ Forum</Link>
      <section className={`zone-card ${s.below}`}>
        <header className={s.detailHead}>
          <div className="eyebrow">{when}</div>
          <h2>{m.title}</h2>
        </header>

        <h2>Agenda</h2>
        {m.body_md ? (
          <Markdown text={m.body_md} />
        ) : (
          <p className="note-line">{m.status === "planned" ? "The agenda is added after the forum." : "No agenda for this forum."}</p>
        )}

        {m.files.length > 0 && (
          <>
            <h2 className={s.actions}>Files</h2>
            <ul className={`rows ${s.files}`}>
              {m.files.map((f) => (
                <li key={f.path}>
                  {f.url ? (
                    <a href={f.url} className="row" target="_blank" rel="noreferrer">
                      <span className="row-main"><b>{f.name}</b></span>
                      <span className="chev" aria-hidden>›</span>
                    </a>
                  ) : (
                    <span className="row"><span className="row-main"><b>{f.name}</b></span></span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className={`actions-row ${s.actions}`}>
          <Link href={`/ask?meeting=${m.id}`} className="btn inline">Ask about this forum</Link>
        </div>
      </section>
    </>
  );
}
