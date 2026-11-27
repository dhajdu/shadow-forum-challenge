import Link from "next/link";
import { getForumContext } from "@/app/_data/context";
import { listLibrary, listMeetings, searchMeetings } from "@/app/_data/forum";
import { longDay } from "@/app/_data/format";
import { MeetingRow } from "./MeetingRow";
import s from "./forum.module.css";

export default async function AgendasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { db, viewer } = await getForumContext();
  const query = q.trim().slice(0, 100);
  const [meetings, library] = await Promise.all([
    query ? searchMeetings(db, viewer, query) : listMeetings(db, viewer),
    listLibrary(db, viewer),
  ]);

  return (
    <div className={s.withRail}>
      <section className="zone-card">
        <form className={s.search} role="search">
          <input className="field" type="search" name="q" defaultValue={query} placeholder="Search your forums…" aria-label="Search agendas" />
        </form>
        {query ? (
          <p className={`note-line ${s.lead}`}>
            {meetings.length} result{meetings.length === 1 ? "" : "s"} for &ldquo;{query}&rdquo; · <Link href="/forum" className="back">Clear</Link>
          </p>
        ) : (
          viewer.forum_joined_on && (
            <p className={`note-line ${s.lead}`}>From your first forum, {longDay(viewer.forum_joined_on)}.</p>
          )
        )}
        {meetings.length === 0 ? (
          <p className="trend-empty">{query ? "No forum notes match that." : "No agendas yet. Each one is added here after its forum."}</p>
        ) : (
          <ul className="rows">
            {meetings.map((m) => (
              <li key={m.id}>
                <MeetingRow m={m} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* desktop: the library beside the agendas (wireframe 14); phones use the Library tab */}
      <aside className={`zone-card ${s.rail}`} aria-label="Library">
        <h2>Library</h2>
        {library.length === 0 && <p className="note-line">Nothing in the library yet.</p>}
        <ul className="rows">
          {library.map((d) => (
            <li key={d.slug}>
              <Link href={`/forum/library/${d.slug}`} className="row">
                <span className="row-main"><b>{d.title}</b></span>
                <span className="chev" aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
