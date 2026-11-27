import Link from "next/link";
import { WhoopConnect, whoopNotice } from "./zone/WhoopConnect";
import { SignOutButton } from "@/components/SignOutButton";
import { isExternallySynced } from "@/lib/whoop/config";
import { ScoreTrend } from "@/components/ScoreTrend";
import { GoalProgress } from "@/components/GoalProgress";
import type { PersonalGoal } from "@/components/ExtraCredit";
import { getStandings } from "@/lib/standings";
import { CONTEST_START_DAY } from "@/lib/contest";
import { coachNameFor } from "@/lib/roster";
import type { GoalStatus } from "@/lib/database.types";
import { selectAll } from "@/lib/supabase/selectAll";
import type { JournalAnalysis } from "@/lib/analyst";
import {
  addDays,
  contestStrip,
  currentStreak,
  journalImpacts,
  latestDay,
  monthly,
  round1,
  shortDate,
  trends,
  type JournalRow,
  type WhoopDay,
} from "./zone/stats";
import s from "./zone/zone.module.css";
import { Settings } from "./Settings";
import { contestSeasonId } from "@/app/_data/season";
import { PageBanner } from "@/components/PageBanner";
import { getForumContext } from "@/app/_data/context";
import { longDay } from "@/app/_data/format";


const SUFFIX = ["th", "st", "nd", "rd"];
const ordinal = (n: number) => n + (SUFFIX[(n % 100 - 20) % 10] || SUFFIX[n % 100] || SUFFIX[0]);

// Score → neon colour, red (low) → amber → blue (high).
const STOPS: [number, [number, number, number]][] = [
  [40, [255, 67, 38]],
  [65, [245, 165, 36]],
  [90, [47, 125, 255]],
];
function scoreColor(score: number, alpha = 1): string {
  const x = Math.max(STOPS[0][0], Math.min(STOPS[2][0], score));
  const i = x <= STOPS[1][0] ? 0 : 1;
  const [x0, c0] = STOPS[i];
  const [x1, c1] = STOPS[i + 1];
  const t = (x - x0) / (x1 - x0);
  const [r, g, b] = c0.map((c, k) => Math.round(c + (c1[k] - c) * t));
  return `rgba(${r},${g},${b},${alpha})`;
}

const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;

// Me: your biometrics (WHOOP), your goals, then account and admin settings.
export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; whoop?: string }>;
}) {
  const { db: supabase, user, viewer } = await getForumContext();
  const contestSeason = await contestSeasonId(supabase, viewer);

  const params = await searchParams;
  const view = params.view === "all" ? "all" : "contest";
  const today = new Date().toISOString().slice(0, 10);
  // journal window: ~3 months for the contest view, ~6 months for all time
  const journalSince = addDays(today, view === "all" ? -182 : -90);

  // independent reads — run them together
  const [
    { data: goalRow },
    { data: me },
    { data: dayRows },
    standings,
    { data: pgRows },
    journalRows,
    connectionResult,
    { data: analysisRow },
  ] = await Promise.all([
    supabase
      .from("goals")
      .select("id, title, unit, target_value, current_value, current_status")
      .eq("user_id", user.id)
      .eq("season_id", contestSeason ?? "")
      .maybeSingle(),
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single(),
    supabase
      .from("whoop_days")
      .select("day, score, recovery, sleep, strain, resting_hr, hrv, missed")
      .eq("user_id", user.id)
      .order("day", { ascending: true }),
    getStandings(supabase),
    supabase
      .from("personal_goals")
      .select("id, title, unit, target_value, current_value")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    // ~25 questions a day adds up fast — page past the 1000-row select cap
    selectAll<JournalRow>((from, to) =>
      supabase
        .from("whoop_journal")
        .select("day, question, answered_yes")
        .eq("user_id", user.id)
        .gte("day", journalSince)
        .order("day")
        .order("question")
        .range(from, to)
    ),
    supabase
      .from("whoop_connection_status")
      .select("status, last_sync_at, last_error")
      .eq("user_id", user.id)
      .maybeSingle(),
    // latest weekly analysis from the Analyst (Claude)
    supabase
      .from("journal_analyses")
      .select("week_of, headline, insights, suggestion")
      .eq("user_id", user.id)
      .order("week_of", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const goal = goalRow as
    | {
        id: string;
        title: string;
        unit: string | null;
        target_value: number | null;
        current_value: number;
        current_status: GoalStatus;
      }
    | null;

  const profile = me as { full_name: string | null; avatar_url: string | null } | null;
  const name = profile?.full_name || "Rider";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const days = (dayRows ?? []) as WhoopDay[];
  const personalGoals = (pgRows ?? []) as PersonalGoal[];

  const rank = standings.findIndex((st) => st.user_id === user.id) + 1;
  const mine = standings[rank - 1];
  const above = rank > 1 ? standings[rank - 2] : null;

  const latest = latestDay(days);
  const strip = contestStrip(days, CONTEST_START_DAY, today);
  const best = strip.reduce<(typeof strip)[number] | null>(
    (b, c) => (c.score != null && (!b || c.score > (b.score as number)) ? c : b),
    null
  );
  const streak = currentStreak(strip);
  const trendRows = trends(days, view === "all" ? "all" : "recent");
  const impacts = journalImpacts(journalRows, days).slice(0, 6);
  const analysis = analysisRow as (JournalAnalysis & { week_of: string }) | null;
  const months = monthly(days);
  const scoredAll = days.filter((d) => d.score != null).map((d) => d.score as number);
  const allAvg = scoredAll.length ? round1(scoredAll.reduce((a, b) => a + b, 0) / scoredAll.length) : null;

  const score7 = trendRows.find((t) => t.key === "score")?.avg7 ?? null;

  return (
    <>
    <PageBanner src="/banners/me.webp" position="50% 40%" />
    <main className={s.page}>
      <header className={s.head}>
        <div className={s.who}>
          <div
            className={s.avatar}
            style={profile?.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : undefined}
          >
            {profile?.avatar_url ? null : initials}
          </div>
          <div>
            <div className="eyebrow">Me</div>
            <h1>{name}</h1>
            <p className={s.sub}>
              {viewer.forum_joined_on ? `In the forum since ${longDay(viewer.forum_joined_on)}` : "First forum date not set yet"}
              {viewer.is_admin ? " · admin" : ""}
            </p>
          </div>
        </div>
        <div className={s.actions}>
          <WhoopConnect
            status={connectionResult.error ? null : (connectionResult.data?.status ?? null)}
            lastSync={connectionResult.error ? null : (connectionResult.data?.last_sync_at ?? null)}
            lastError={connectionResult.error ? null : (connectionResult.data?.last_error ?? null)}
            external={isExternallySynced(user.id)}
            notice={whoopNotice(params.whoop)}
          />
          <SignOutButton className="btn-ghost" />
        </div>
      </header>

      <section className={s.stats} aria-label="Your numbers">
        <div className={s.stat}>
          <span>Latest score{latest ? ` · ${shortDate(latest.day)}` : ""}</span>
          <b className={s.hero}>{latest?.score ?? "—"}</b>
          {latest?.delta != null && <small className={latest.delta >= 0 ? s.up : s.down}>{signed(latest.delta)} vs 30-day avg</small>}
        </div>
        <div className={s.stat}>
          <span>7-day average</span>
          <b>{score7 ?? "—"}</b>
        </div>
        <div className={s.stat}>
          <span>Race</span>
          <b>{mine ? ordinal(rank) : "—"}</b>
          {mine && <small className={s.muted}>of {standings.length} · avg {mine.avg}</small>}
        </div>
        <div className={s.stat}>
          <span>Streak</span>
          <b>{streak}</b>
          <small className={s.muted}>scored days in a row</small>
        </div>
      </section>

      <div className={s.cols}>
        <section className="zone-card">
          <h2>Biometrics</h2>
          {latest ? (
            <>
              <div className={s.parts}>
                {latest.parts.map((p) => (
                  <div className={s.part} key={p.label}>
                    <span>{p.label}</span>
                    <div className={s.track}>
                      <i style={{ width: `${p.pct}%` }} />
                    </div>
                    <b>{p.text}</b>
                  </div>
                ))}
              </div>
              <p className={s.note}>{latest.note}</p>
            </>
          ) : (
            <p className="trend-empty">No scored days yet — connect WHOOP and they sync in.</p>
          )}
          {days.length > 0 && (
            <div className={s.trendBlock}>
              <div className={`${s.trow} ${s.thead}`}>
                <span className={s.tlabel}>Last 7 vs 30 days</span>
                <span className={s.t7}>7d</span>
                <span className={s.t30}>30d</span>
                <span className={s.tdelta}>trend</span>
              </div>
                {trendRows.map((t) => {
                return (
                  <details className={s.tdetails} key={t.key}>
                    <summary className={s.trow}>
                      <span className={s.tlabel}>{t.label}</span>
                      <b className={s.t7}>{t.avg7 ?? "—"}</b>
                      <span className={`${s.t30} ${s.muted}`}>{t.avg30 ?? "—"}</span>
                      <span className={`${s.tdelta} ${t.good == null ? s.muted : t.good ? s.up : s.down}`}>
                        {t.delta == null ? "—" : `${t.delta > 0 ? "▲" : t.delta < 0 ? "▼" : "▶"} ${signed(t.delta)}${t.unit}`}
                      </span>
                    </summary>
                    <div className={s.full}>
                      <ScoreTrend scores={t.all} />
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>

        <div className={s.side}>
          <section className="zone-card">
            <h2>Business goal</h2>
            {goal ? (
              <>
                <p className="coach-line">
                  Your coach: <b>{coachNameFor(name) ?? "to be assigned"}</b>
                </p>
                <GoalProgress
                  title={goal.title}
                  unit={goal.unit}
                  targetValue={goal.target_value}
                  currentValue={goal.current_value}
                  currentStatus={goal.current_status}
                />
              </>
            ) : (
              <p className="note-line">
                No business goal for this season yet. <Link href="/welcome" className="back">Set your goal</Link>
              </p>
            )}
          </section>

          <section className="zone-card">
            <h2>Your goals</h2>
            <Link href="/goals" className="row">
              <span className="row-main"><b>{personalGoals.length ? `${personalGoals.length} goal${personalGoals.length === 1 ? "" : "s"} set` : "Set your goals"}</b><small>Add as many as you like for each quarter</small></span>
              <span className="chev" aria-hidden>→</span>
            </Link>
          </section>
        </div>
      </div>

      <details className={s.more}>
        <summary>More WHOOP detail</summary>
        <div className={`seg ${s.viewToggle}`}>
          <Link href="/me" className={`seg-btn ${view === "contest" ? "on" : ""}`}>This season</Link>
          <Link href="/me?view=all" className={`seg-btn ${view === "all" ? "on" : ""}`}>All time</Link>
        </div>
        <div className={s.cols}>
        {view === "all" ? (
        <section className="zone-card">
          <h2>Monthly averages</h2>
          {months.length === 0 ? (
            <p className="trend-empty">No scored days yet — connect WHOOP and they sync in.</p>
          ) : (
            <div className={s.months}>
              {months.slice(-12).map((m) => (
                <div className={s.month} key={m.month} title={`${m.label} · ${m.avg} avg over ${m.days} days`}>
                  <span className={s.monthBar}>
                    <i style={{ height: `${Math.max(4, m.avg)}%`, background: scoreColor(m.avg, 0.85) }} />
                  </span>
                  <b>{Math.round(m.avg)}</b>
                  <span>{m.label}</span>
                </div>
              ))}
            </div>
          )}
          <div className={s.tiles}>
            <div className={s.tile}>
              <b>{allAvg ?? "—"}</b>
              <span>all-time avg</span>
            </div>
            <div className={s.tile}>
              <b>{scoredAll.length ? Math.max(...scoredAll) : "—"}</b>
              <span>best day ever</span>
            </div>
            <div className={s.tile}>
              <b>{scoredAll.length}</b>
              <span>scored days</span>
            </div>
          </div>
        </section>
        ) : (
        <section className="zone-card">
          <h2>Daily progress</h2>
          <div className={s.strip}>
            {strip.map((c) => (
              <div
                key={c.day}
                className={`${s.cell} ${c.state === "missed" ? s.missed : c.state === "pending" ? s.pending : ""}`}
                style={
                  c.score != null
                    ? { borderColor: scoreColor(c.score), background: scoreColor(c.score, 0.28) }
                    : undefined
                }
                title={`${shortDate(c.day)} · ${c.score != null ? c.score : c.state === "missed" ? "missed" : "no data yet"}`}
              >
                {c.score != null ? Math.round(c.score) : c.state === "missed" ? "×" : ""}
              </div>
            ))}
          </div>
          <div className={s.tiles}>
            <div className={s.tile}>
              <b>{best ? `${best.score} · ${shortDate(best.day)}` : "—"}</b>
              <span>best day</span>
            </div>
            <div className={s.tile}>
              <b>{streak}</b>
              <span>day streak</span>
            </div>
            <div className={s.tile}>
              <b>{above && mine ? round1(above.avg - mine.avg) : "—"}</b>
              <span>{above ? `gap to ${above.full_name}` : "gap to next"}</span>
            </div>
          </div>
        </section>
        )}
        <section className={`zone-card ${s.journal}`}>
          <h2>Journal insights</h2>
          {analysis ? (
            <div className={s.analysis}>
              <p className={s.aHead}>{analysis.headline}</p>
              <ul className={s.aList}>
                {analysis.insights.map((i) => (
                  <li key={i.title} className={i.effect === "helps" ? s.aHelps : i.effect === "hurts" ? s.aHurts : s.aMixed}>
                    <b>{i.title}</b>
                    <span>{i.detail}</span>
                  </li>
                ))}
              </ul>
              <p className={s.aTry}>
                <b>Try this week:</b> {analysis.suggestion}
              </p>
              <p className={s.aMeta}>Weekly analysis by Claude · {longDay(analysis.week_of)} · journal vs scores, last 90 days</p>
            </div>
          ) : (
            <p className={s.note}>Your weekly analysis arrives Monday morning, once a week of journal answers has synced.</p>
          )}
          <h3 className={s.jNumbers}>The numbers · {view === "all" ? "last 6 months" : "last 3 months"}</h3>
          <p className={s.note}>How your WHOOP journal answers line up with the next morning&apos;s recovery and sleep.</p>
          {impacts.length === 0 ? (
            <p className="trend-empty">
              Not enough journal answers yet — keep answering the WHOOP journal each morning; it syncs in.
            </p>
          ) : (
            <div className={s.jlist}>
              {impacts.map((j) => (
                <div className={s.jrow} key={j.question}>
                  <div>
                    <b>{j.question}</b>
                    <span>
                      yes on {j.yesDays} of {j.answered} days · {j.thisWeek} this week
                    </span>
                  </div>
                  <div className={s.jstat}>
                    <b className={j.recoveryDiff >= 0 ? s.up : s.down}>{signed(j.recoveryDiff)}</b>
                    <span>recovery</span>
                  </div>
                  <div className={s.jstat}>
                    <b className={j.sleepDiff == null ? s.muted : j.sleepDiff >= 0 ? s.up : s.down}>
                      {j.sleepDiff == null ? "—" : signed(j.sleepDiff)}
                    </b>
                    <span>sleep</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        </div>
      </details>

      <div className={s.settings}>
        <Settings viewer={viewer} />
      </div>
    </main>
    </>
  );
}
