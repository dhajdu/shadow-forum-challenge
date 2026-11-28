import Link from "next/link";
import { getForumContext } from "@/app/_data/context";
import { getModerator, listUpcoming } from "@/app/_data/forum";
import { monthLabel, timeOf, weekdayDay } from "@/app/_data/format";
import s from "../forum.module.css";

/** The two calendar months after `from` (YYYY-MM-DD) as YYYY-MM keys. */
function nextMonths(from: string, n: number): string[] {
  const [y, mo] = from.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, mo - 1 + i + 1, 1));
    return d.toISOString().slice(0, 7);
  });
}

export default async function DatesPage() {
  const { db, viewer, today, forum } = await getForumContext();
  const [upcoming, moderator] = await Promise.all([listUpcoming(db, viewer, today), getModerator(db)]);
  const next = upcoming[0];
  const setMonths = new Set(upcoming.map((m) => m.held_on.slice(0, 7)));
  const unset = nextMonths(next?.held_on ?? today, 2).filter((ym) => !setMonths.has(ym));

  return (
    <div className={s.grid}>
      <section className="zone-card">
        <h2>Next</h2>
        {next ? (
          <Link href={next.path} className={`row ${s.next}`}>
            <span className="row-main">
              <b>{weekdayDay(next.held_on)}{next.starts_at ? ` · ${timeOf(next.starts_at, forum.timeZone)}` : ""}</b>
              <span>{next.place ?? "Place to be confirmed"}</span>
            </span>
            <span className="chev" aria-hidden>→</span>
          </Link>
        ) : (
          <p className="note-line">The next forum date is not set yet.</p>
        )}
        <ul className={`rows ${s.tight}`}>
          {upcoming.slice(1).map((m) => (
            <li key={m.id}>
              <Link href={m.path} className="row">
                <span className="row-main">
                  <b>{weekdayDay(m.held_on)}{m.starts_at ? ` · ${timeOf(m.starts_at, forum.timeZone)}` : ""}</b>
                  {m.place && <small>{m.place}</small>}
                </span>
              </Link>
            </li>
          ))}
          {unset.map((ym) => (
            <li key={ym} className="row">
              <span className="row-main"><b>{monthLabel(ym)}</b><small>Date not set yet</small></span>
            </li>
          ))}
        </ul>
      </section>
      <section className="zone-card">
        <h2>Moderator</h2>
        <p className="prose">{moderator}</p>
        <p className={`note-line ${s.tight}`}>
          Past forums are under Agendas.
        </p>
      </section>
    </div>
  );
}
