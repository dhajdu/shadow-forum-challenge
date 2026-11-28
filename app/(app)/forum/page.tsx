import Link from "next/link";
import { getForumContext } from "@/app/_data/context";
import { listMeetings, searchMeetings } from "@/app/_data/forum";
import { longDay, weekdayDay } from "@/app/_data/format";
import { MeetingRow } from "./MeetingRow";
import s from "./forum.module.css";

export default async function AgendasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { db, viewer, today } = await getForumContext();
  const query = q.trim().slice(0, 100);
  const meetings = query ? await searchMeetings(db, viewer, query) : await listMeetings(db, viewer);
  // without a search: coming forums first (soonest first), then past forums (newest first)
  const upcoming = query ? [] : meetings.filter((m) => m.status === "planned" && m.held_on >= today).reverse();
  const past = query ? meetings : meetings.filter((m) => !upcoming.includes(m));

  return (
    <section className={s.agenda}>
      <form className={s.search} role="search">
        <input className="field" type="search" name="q" defaultValue={query} placeholder="Search your forums…" aria-label="Search agendas" />
      </form>
      {query ? (
        <p className={`note-line ${s.lead}`}>
          {meetings.length} result{meetings.length === 1 ? "" : "s"} for &ldquo;{query}&rdquo; · <Link href="/forum" className="back">Clear</Link>
        </p>
      ) : (
        viewer.forum_joined_on && <p className={`note-line ${s.lead}`}>From your first forum, {longDay(viewer.forum_joined_on)}.</p>
      )}
      {upcoming.length > 0 && (
        <section className={s.upcoming} aria-label="Coming forums">
          <h2 className={s.label}>Coming up</h2>
          <ol className={s.dates}>
            {upcoming.map((m, i) => (
              <li key={m.id}>
                <Link href={m.path} className={`${s.date} ${i === 0 ? s.nextDate : ""}`}>
                  <span>{i === 0 ? "Next" : weekdayDay(m.held_on).split(" ")[0]}</span>
                  <b>{weekdayDay(m.held_on).split(" ").slice(1).join(" ")}</b>
                  <small>{m.place ?? "Place TBC"}</small>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
      {upcoming.length > 0 && <h2 className={s.label}>Past forums</h2>}
      {past.length === 0 && upcoming.length === 0 ? (
        <p className="trend-empty">{query ? "No forum notes match that." : "No agendas yet. Each one is added here after its forum."}</p>
      ) : (
        <ul className="rows">
          {past.map((m) => (
            <li key={m.id}>
              <MeetingRow m={m} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
