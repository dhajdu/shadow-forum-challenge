import Link from "next/link";
import { cookies } from "next/headers";
import { getForumContext } from "@/app/_data/context";
import { listLibrary, listMeetings, listSeasons, memberStatus, touchLastSeen } from "@/app/_data/forum";
import { shortDay, timeOf, weekdayDay } from "@/app/_data/format";
import { MeetingRow } from "@/app/(app)/forum/MeetingRow";
import { ForumAsk } from "@/components/ForumAsk";
import { getStandings } from "@/lib/standings";
import { CONTEST_DAYS, dayOfContest } from "@/lib/contest";
import type { GoalStatus } from "@/lib/database.types";
import { LAST_VISIT_COOKIE, MarkVisit } from "./MarkVisit";
import s from "./home.module.css";

const SUFFIX = ["th", "st", "nd", "rd"];
const ordinal = (n: number) => n + (SUFFIX[(n % 100 - 20) % 10] || SUFFIX[n % 100] || SUFFIX[0]);

const STATUS_LABEL: Record<GoalStatus, string> = { on_track: "on track", at_risk: "at risk", behind: "behind", hit: "hit" };

function greeting(): string {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

type NewItem = { key: string; href: string; text: string; when: string };

export async function HomeView() {
  const { db, user, viewer, today } = await getForumContext();
  const [meetings, library, seasons] = await Promise.all([
    listMeetings(db, viewer),
    listLibrary(db, viewer),
    listSeasons(db, viewer),
  ]);

  const next = [...meetings].reverse().find((m) => m.status === "planned" && m.held_on >= today) ?? null;
  const newest = meetings.find((m) => m.status === "held") ?? null;
  const isFirst = next != null && next.held_on === viewer.forum_joined_on;

  // what's new since the last visit (first visit: the last 30 days)
  // profiles.last_seen_at when the database has it, else this browser's cookie
  const [lastSeen, jar] = await Promise.all([touchLastSeen(db), cookies()]);
  const lastVisit = lastSeen ?? (jar.get(LAST_VISIT_COOKIE)?.value ? decodeURIComponent(jar.get(LAST_VISIT_COOKIE)!.value) : null);
  const since = lastVisit ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
  const fresh: NewItem[] = [
    ...meetings
      .filter((m) => new Date(m.updated_at) > new Date(since))
      .map((m) => ({
        key: m.id,
        href: m.path,
        text: m.status === "planned" ? `Forum date set: ${weekdayDay(m.held_on)}` : `New agenda: ${shortDay(m.held_on)} · ${m.title}`,
        when: m.updated_at,
      })),
    ...library
      .filter((d) => new Date(d.updated_at) > new Date(since))
      .map((d) => ({ key: d.slug, href: `/forum/library/${d.slug}`, text: `Updated: ${d.title}`, when: d.updated_at })),
  ].sort((a, b) => b.when.localeCompare(a.when));

  // contest card only while this member has a season that is running (or just finished)
  const season = seasons.find((x) => today <= addDays(x.ends_on, 9)) ?? null;
  let place: { rank: number; of: number; avg: number; stale: boolean } | null = null;
  let goal: { status: GoalStatus; pct: number | null } | null = null;
  if (season) {
    try {
      const [standings, { data: g }] = await Promise.all([
        getStandings(db),
        db.from("goals").select("current_status, current_value, target_value").eq("user_id", user.id).maybeSingle(),
      ]);
      const i = standings.findIndex((st) => st.user_id === user.id);
      if (i >= 0) place = { rank: i + 1, of: standings.length, avg: standings[i].avg, stale: standings[i].stale };
      const row = g as { current_status: GoalStatus; current_value: number; target_value: number | null } | null;
      if (row)
        goal = {
          status: row.current_status,
          pct: row.target_value ? Math.min(100, Math.round((row.current_value / row.target_value) * 100)) : null,
        };
    } catch {
      place = null;
    }
  }

  const first = viewer.full_name.split(/\s+/)[0];
  const status = memberStatus(viewer, today);

  return (
    <main className={`page ${s.withRail}`}>
      <MarkVisit />
      <div className={s.mainCol}>
      <header className="page-head">
        <div className="eyebrow">The Shadow Forum</div>
        <h1>{greeting()}, {first}</h1>
      </header>

      {status !== "active" && (
        <section className={`zone-card ${s.notice}`}>
          <h2>{status === "left" ? "You are no longer in the forum" : "Your access is being set up"}</h2>
          <p className="note-line">
            {status === "left"
              ? "Your forum access has ended. Ask Dave if you think this is a mistake."
              : "Dave adds your first forum date, and your forums appear here from then on."}
          </p>
        </section>
      )}

      <div className={s.grid}>
        <section className={`zone-card ${s.next}`}>
          <h2>{isFirst ? "Your first forum" : "Next forum"}</h2>
          {next ? (
            <>
              <b className={s.big}>
                {weekdayDay(next.held_on)}
                {next.starts_at ? ` · ${timeOf(next.starts_at)}` : ""}
              </b>
              <p className="note-line">{next.place ?? "Place to be confirmed"}</p>
              {isFirst && <p className="note-line">Welcome to the Shadow, {first}.</p>}
              <div className={`actions-row ${s.actions}`}>
                <a className="btn inline" href={`${next.path}/calendar.ics`}>Add to calendar</a>
                <Link className="btn-ghost inline" href="/forum/dates">All dates</Link>
              </div>
            </>
          ) : (
            <p className="note-line">The next forum date is not set yet. The moderator sets it in EO Vietnam.</p>
          )}
        </section>

        {season ? (
          <Link href="/contest" className={`zone-card ${s.cardLink}`}>
            <h2>Race Into the Shadow · {season.name}</h2>
            <b className={s.big}>{place ? `${ordinal(place.rank)} of ${place.of} · avg ${place.avg}` : "Not on the board yet"}</b>
            <p className="note-line">
              {today <= season.ends_on ? `Day ${dayOfContest()} of ${CONTEST_DAYS}` : "Season over · the kitty settles on 31 Dec"}
            </p>
            {goal && (
              <p className={`note-line ${s.goal}`}>
                Your goal <span className={`chip ${goal.status}`}>{STATUS_LABEL[goal.status]}</span>
                {goal.pct != null ? ` · ${goal.pct}%` : ""}
              </p>
            )}
            {place?.stale && today <= season.ends_on && (
              <p className={s.whip}>The Whip: no new WHOOP data for over a week. Open WHOOP to sync.</p>
            )}
          </Link>
        ) : (
          <section className="zone-card">
            <h2>Start here</h2>
            <ul className="rows">
              {library.slice(0, 2).map((d) => (
                <li key={d.slug}>
                  <Link href={`/forum/library/${d.slug}`} className="row">
                    <span className="row-main"><b>Read the {d.title}</b></span>
                    <span className="chev" aria-hidden>›</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/me" className="row">
                  <span className="row-main"><b>Connect WHOOP for the next season</b></span>
                  <span className="chev" aria-hidden>›</span>
                </Link>
              </li>
            </ul>
          </section>
        )}

        <section className="zone-card">
          <h2>New since your last visit</h2>
          {fresh.length === 0 ? (
            <p className="note-line">Nothing new since your last visit.</p>
          ) : (
            <ul className="rows">
              {fresh.slice(0, 5).map((f) => (
                <li key={f.key}>
                  <Link href={f.href} className="row">
                    <span className="row-main"><b>{f.text}</b></span>
                    <span className="chev" aria-hidden>›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {newest && (
          <section className="zone-card">
            <h2>Newest agenda</h2>
            <MeetingRow m={newest} />
          </section>
        )}
      </div>
      </div>
      <aside className={`zone-card ${s.rail}`} aria-label="Ask">
        <h2>Ask</h2>
        <ForumAsk suggestions={["What did I commit to at the last forum?"]} />
      </aside>
    </main>
  );
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
