import Link from "next/link";
import { notFound } from "next/navigation";
import { getForumContext } from "@/app/_data/context";
import { getMeeting } from "@/app/_data/forum";
import { parseRecap, visibleParking } from "@/app/_data/recap";
import { timeOf, weekdayDay } from "@/app/_data/format";
import { Markdown } from "@/components/Markdown";
import { ParkingLot } from "../ParkingLot";
import r from "../recap.module.css";

export default async function AgendaPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  // a date (web links) or a meeting id (push deep links)
  if (!/^(\d{4}-\d{2}-\d{2}|[0-9a-f-]{36})$/i.test(date)) notFound();
  const { db, viewer } = await getForumContext();
  // not visible and not there look the same: 404, with no hint either way
  const m = await getMeeting(db, viewer, date);
  if (!m) notFound();

  const recap = m.body_md ? parseRecap(m.body_md, m.held_on) : null;
  const parking = recap ? visibleParking(recap.parking, viewer.forum_joined_on, viewer.is_founding) : [];
  const place = m.place ?? recap?.place ?? null;
  const total = recap?.sections.reduce((a, x) => a + (x.minutes ?? 0), 0) ?? 0;

  return (
    <article className={r.recap}>
      <Link href="/forum" className="back">← Forum</Link>

      <header className={r.head}>
        <span className={r.kicker}>{m.status === "planned" ? "Coming forum" : "Forum recap"}</span>
        <h2 className={r.title}>{m.title}</h2>
        <p className={r.when}>
          {weekdayDay(m.held_on)} {m.held_on.slice(0, 4)}
          {m.starts_at ? ` · ${timeOf(m.starts_at)}` : ""}
          {place ? ` · ${place}` : ""}
        </p>
        {recap?.purpose && <blockquote className={r.purpose}>{recap.purpose}</blockquote>}
        <div className="actions-row">
          <Link href={`/ask?meeting=${m.id}`} className="btn inline">Ask about this forum</Link>
          {m.files.map((f) =>
            f.url ? (
              <a key={f.path} href={f.url} className="btn-ghost inline" target="_blank" rel="noreferrer">{f.name}</a>
            ) : null
          )}
        </div>
      </header>

      {!recap ? (
        <p className="note-line">{m.status === "planned" ? "The recap is added after the forum." : "No agenda for this forum."}</p>
      ) : (
        <div className={r.cols}>
          <section className={r.flow} aria-label="The forum">
            <h3 className={r.label}>The forum{total ? ` · ${Math.floor(total / 60)}h${total % 60 ? ` ${total % 60}m` : ""}` : ""}</h3>
            <ol className={r.timeline}>
              {recap.sections.map((x, i) => (
                <li key={i} className={r.step}>
                  <span className={r.mins}>{x.minutes ? `${x.minutes}′` : ""}</span>
                  <details className={r.stepBody} open={i < 1}>
                    <summary>{x.title}</summary>
                    {x.body ? <Markdown text={x.body} /> : null}
                  </details>
                </li>
              ))}
            </ol>
          </section>

          <aside className={r.side}>
            <section>
              <h3 className={r.label}>Parking lot</h3>
              <ParkingLot groups={parking} />
            </section>
            {recap.learnings.length > 0 && (
              <section>
                <h3 className={r.label}>Learnings</h3>
                <ol className={r.learnings}>
                  {recap.learnings.map((l, i) => (
                    <li key={i}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <p>{l}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </aside>
        </div>
      )}
    </article>
  );
}
