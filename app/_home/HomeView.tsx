import Image from "next/image";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { cookies } from "next/headers";
import { getForumContext } from "@/app/_data/context";
import { getLibraryDoc, listLibrary, listMeetings, listSeasons, memberStatus, touchLastSeen } from "@/app/_data/forum";
import { parseVision } from "@/app/_data/vision";
import { shortDay, timeOf, weekdayDay } from "@/app/_data/format";
import { MeetingRow } from "@/app/(app)/forum/MeetingRow";
import { ForumAsk } from "@/components/ForumAsk";
import { listGallery } from "@/app/_data/gallery";
import { getKitty, vndShort } from "@/app/_data/kitty";
import { getStandings } from "@/lib/standings";
import { dayOfSeason, hasContest, seasonLength } from "@/lib/contest";
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
  const [meetings, library, seasons, photos, home, kitty] = await Promise.all([
    listMeetings(db, viewer),
    listLibrary(db, viewer),
    listSeasons(db, viewer),
    listGallery(db, 6),
    getLibraryDoc(db, viewer, "home"),
    getKitty(db).catch(() => null),
  ]);
  const treasurer = kitty?.treasurerId
    ? (await db.from("profiles").select("full_name").eq("id", kitty.treasurerId).maybeSingle()).data?.full_name?.split(/\s+/)[0] ?? null
    : null;
  const vision = home ? parseVision(home.body_md) : null;

  // goals for the quarter that is running, else the next one
  const goalSeason =
    seasons.find((x) => x.starts_on <= today && today <= x.ends_on && !x.slug.endsWith("q4")) ??
    [...seasons].reverse().find((x) => x.starts_on > today) ??
    null;
  let goalCount = 0;
  if (goalSeason) {
    const { count } = await (db as unknown as SupabaseClient)
      .from("personal_goals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("season_id", goalSeason.id);
    goalCount = count ?? 0;
  }

  const next = [...meetings].reverse().find((m) => m.status === "planned" && m.held_on >= today) ?? null;
  const newest = meetings.find((m) => m.status === "held") ?? null;
  const isFirst = next != null && next.held_on === viewer.forum_joined_on;

  // what's new since the last visit (first visit: the last 30 days)
  // profiles.last_seen_at when the database has it, else this browser's cookie
  const [lastSeen, jar] = await Promise.all([touchLastSeen(db), cookies()]);
  const lastVisit = lastSeen ?? (jar.get(LAST_VISIT_COOKIE)?.value ? decodeURIComponent(jar.get(LAST_VISIT_COOKIE)!.value) : null);
  const since = lastVisit ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
  const changed = meetings.filter((m) => new Date(m.updated_at) > new Date(since));
  const newDates = changed.filter((m) => m.status === "planned").sort((a, b) => a.held_on.localeCompare(b.held_on));
  const fresh: NewItem[] = [
    ...(newDates.length > 2
      ? [{
          key: "dates",
          href: "/forum",
          text: `${newDates.length} forum dates set · ${shortDay(newDates[0].held_on)} to ${shortDay(newDates[newDates.length - 1].held_on)}`,
          when: newDates.map((m) => m.updated_at).sort().pop()!,
        }]
      : []),
    ...changed
      .filter((m) => newDates.length <= 2 || m.status !== "planned")
      .map((m) => ({
        key: m.id,
        href: m.path,
        text: m.status === "planned" ? `Forum date set: ${weekdayDay(m.held_on)}` : `New agenda: ${shortDay(m.held_on)} · ${m.title}`,
        when: m.updated_at,
      })),
    ...library
      .filter((d) => new Date(d.updated_at) > new Date(since))
      .map((d) => ({ key: d.slug, href: `/forum/resources/${d.slug}`, text: `Updated: ${d.title}`, when: d.updated_at })),
  ].sort((a, b) => b.when.localeCompare(a.when));

  // contest card only while a season with a contest is running (or just finished)
  const season = seasons.find((x) => x.starts_on <= today && today <= addDays(x.ends_on, 9) && hasContest(x)) ?? null;
  let place: { rank: number; of: number; avg: number; stale: boolean } | null = null;
  let goal: { status: GoalStatus; pct: number | null } | null = null;
  if (season) {
    try {
      const [standings, { data: g }] = await Promise.all([
        getStandings(db),
        db.from("goals").select("current_status, current_value, target_value").eq("user_id", user.id).eq("season_id", season.id).maybeSingle(),
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
  const suffix = place ? ordinal(place.rank).slice(String(place.rank).length) : "";

  return (
    <main className={s.home}>
      <MarkVisit />
      <section className={s.hero}>
        <Image src="/hero.webp" alt="" fill priority sizes="100vw" className={s.heroImg} />
        <div className={s.heroInner}>
          <p className={s.greet}>{greeting()}, {first}</p>
          <span className={s.kicker}>{isFirst ? "Your first forum" : "Next forum"}</span>
          {next ? (
            <>
              <h1 className={s.date}>{weekdayDay(next.held_on)}</h1>
              <p className={s.meta}>
                {[next.starts_at && timeOf(next.starts_at), next.place ?? "Place to be confirmed"].filter(Boolean).join(" · ")}
                {isFirst ? ` · welcome to the Shadow, ${first}` : ""}
              </p>
              <div className="actions-row">
                <a className="btn inline" href={googleCalendarUrl(next)} target="_blank" rel="noreferrer">Add to Google Calendar</a>
                <a className="btn-ghost inline" href={`${next.path}/calendar.ics`}>Apple / Outlook</a>
              </div>
            </>
          ) : (
            <>
              <h1 className={s.date}>Date not set</h1>
              <p className={s.meta}>Dave sets the next forum date. It shows here as soon as it is in.</p>
            </>
          )}
        </div>
      </section>

      {vision && (vision.is || vision.ambition) && (
        <section className={s.vision} aria-label="Our vision">
          <div className={s.visionInner}>
            {vision.is && (
              <div className={s.visionItem}>
                <span className={s.kicker}>The Shadow Forum is</span>
                <p>{vision.is}</p>
              </div>
            )}
            {vision.ambition && (
              <div className={s.visionItem}>
                <span className={s.kicker}>Our ambition</span>
                <p>{vision.ambition}</p>
              </div>
            )}
            <Link href="/forum/resources/home" className={`btn inline ${s.into}`}>Into the Shadow →</Link>
          </div>
        </section>
      )}

      <div className={`page ${s.body}`}>
        <div className={s.mainCol}>
          {status !== "active" && (
            <section className={s.notice}>
              <h2>{status === "left" ? "You are no longer in the forum" : "Your access is being set up"}</h2>
              <p className="note-line">
                {status === "left"
                  ? "Your forum access has ended. Ask Dave if you think this is a mistake."
                  : "Dave adds your first forum date, and your forums appear here from then on."}
              </p>
            </section>
          )}

          {goalSeason && (
            <Link href={`/goals?season=${goalSeason.slug}`} className={s.line}>
              <span>
                <span className={s.label}>Your {goalSeason.name} goals</span>
                <b>{goalCount ? `${goalCount} goal${goalCount === 1 ? "" : "s"} locked in` : "Lock in your goals"}</b>
              </span>
              <span className={`${s.status} ${goalCount ? s.on_track : s.at_risk}`}>{goalCount ? "Update" : "Set now"} →</span>
            </Link>
          )}

          {kitty && kitty.balance != null && (
            <Link href="/kitty" className={s.line}>
              <span>
                <span className={s.label}>The kitty</span>
                <b className={s.kitty}>{vndShort(kitty.balance)} ₫</b>
              </span>
              <span className={s.status}>{treasurer ? `Held by ${treasurer}` : "Ledger"} →</span>
            </Link>
          )}

          {season ? (
            <Link href="/contest" className={s.race}>
              <span className={s.place}>
                {place ? (
                  <>
                    {place.rank}
                    <sup>{suffix}</sup>
                  </>
                ) : (
                  "—"
                )}
              </span>
              <span className={s.raceText}>
                <span className={s.label}>Race into the Shadow · {season.name}</span>
                <b>{place ? `of ${place.of} riders · avg ${place.avg}` : "Not on the board yet"}</b>
                <span className="note-line">
                  {today <= season.ends_on ? `Day ${dayOfSeason(season)} of ${seasonLength(season)}` : "Season over · the kitty settles on 31 Dec"}
                </span>
              </span>
            </Link>
          ) : null}

          {season && (
            <div className={s.progress} aria-hidden>
              <i style={{ width: `${Math.min(100, (dayOfSeason(season) / seasonLength(season)) * 100)}%` }} />
            </div>
          )}

          {goal && (
            <Link href={`/goals?season=${season!.slug}`} className={s.line}>
              <span>
                <span className={s.label}>Your goal</span>
                <b>{goal.pct != null ? `${goal.pct}%` : "In progress"}</b>
              </span>
              <span className={`${s.status} ${s[goal.status]}`}>{STATUS_LABEL[goal.status]}</span>
            </Link>
          )}

          {season && place?.stale && today <= season.ends_on && (
            <p className={s.whip}>The Whip — no new WHOOP data for over a week. Open WHOOP to sync.</p>
          )}

          {!season && (
            <section className={s.block}>
              <h2 className={s.label}>Start here</h2>
              <ul className="rows">
                {library.slice(0, 2).map((d) => (
                  <li key={d.slug}>
                    <Link href={`/forum/resources/${d.slug}`} className="row">
                      <span className="row-main"><b>Read the {d.title}</b></span>
                      <span className="chev" aria-hidden>→</span>
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/biometrics" className="row">
                    <span className="row-main"><b>Connect WHOOP for the next season</b></span>
                    <span className="chev" aria-hidden>→</span>
                  </Link>
                </li>
              </ul>
            </section>
          )}

          <section className={s.block}>
            <h2 className={s.label}>New since your last visit</h2>
            {fresh.length === 0 ? (
              <p className="note-line">Nothing new since your last visit.</p>
            ) : (
              <ul className="rows">
                {fresh.slice(0, 5).map((f) => (
                  <li key={f.key}>
                    <Link href={f.href} className="row">
                      <span className="row-main"><b>{f.text}</b></span>
                      <span className="chev" aria-hidden>→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {photos.length > 0 && (
            <section className={s.block}>
              <Link href="/gallery" className={s.galleryHead}>
                <h2 className={s.label}>Gallery</h2>
                <span className="note-line">See all →</span>
              </Link>
              <ul className={s.gallery}>
                {photos.map((p) => (
                  <li key={p.id}>
                    <Link href="/gallery" aria-label="Open the gallery">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, already a thumbnail */}
                      {p.thumb && <img src={p.thumb} alt={p.caption ?? ""} loading="lazy" />}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {newest && (
            <section className={s.block}>
              <h2 className={s.label}>Newest agenda</h2>
              <MeetingRow m={newest} />
            </section>
          )}
        </div>

        <aside className={s.rail} aria-label="Ask AI">
          <h2 className={s.label}>Ask AI about the forum</h2>
          <ForumAsk suggestions={["What did I commit to at the last forum?"]} />
        </aside>
      </div>
    </main>
  );
}

/** Google Calendar "add event" link (opens Google with the forum filled in). */
function googleCalendarUrl(m: { held_on: string; starts_at: string | null; place: string | null; title: string }): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  let dates: string;
  if (m.starts_at) {
    const start = new Date(m.starts_at);
    dates = `${stamp(start)}/${stamp(new Date(start.getTime() + 3 * 3_600_000))}`;
  } else {
    dates = `${m.held_on.replace(/-/g, "")}/${addDays(m.held_on, 1).replace(/-/g, "")}`;
  }
  const q = new URLSearchParams({ action: "TEMPLATE", text: `Shadow Forum · ${m.title}`, dates, details: "The Shadow Forum" });
  if (m.place) q.set("location", m.place);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
