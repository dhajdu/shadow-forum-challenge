import Link from "next/link";
import { getForumContext } from "@/app/_data/context";
import { listMeetings, searchMeetings } from "@/app/_data/forum";
import { longDay } from "@/app/_data/format";
import { MeetingRow } from "./MeetingRow";
import s from "./forum.module.css";

export default async function AgendasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { db, viewer } = await getForumContext();
  const query = q.trim().slice(0, 100);
  const meetings = query ? await searchMeetings(db, viewer, query) : await listMeetings(db, viewer);

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
  );
}
