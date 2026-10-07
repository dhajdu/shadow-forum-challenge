import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";
import { UploadWhoop } from "@/components/UploadWhoop";
import { ScoreTrend } from "@/components/ScoreTrend";
import { GoalProgress } from "@/components/GoalProgress";
import { ExtraCredit, type PersonalGoal } from "@/components/ExtraCredit";
import { SignOutButton } from "@/components/SignOutButton";
import { getStandings } from "@/lib/standings";
import { CONTEST_START_DAY } from "@/lib/contest";
import { coachNameFor } from "@/lib/roster";
import type { GoalStatus } from "@/lib/database.types";
import { getSessionUser } from "@/lib/supabase/session";
import { selectAll } from "@/lib/supabase/selectAll";
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
} from "./stats";
import s from "./me.module.css";

type Upload = { id: string; file_name: string; status: string; created_at: string };

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

export default async function MyZone({ searchParams }: { searchParams: Promise<{ view?: string; upload?: string }> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/");

  const params = await searchParams;
  const view = params.view === "all" ? "all" : "contest";
  const today = new Date().toISOString().slice(0, 10);
  // journal window: ~3 months for the contest view, ~6 months for all time
  const journalSince = addDays(today, view === "all" ? -182 : -90);

  // independent reads — run them together
  const [
    { data: goalRow },
    { data: me },
    { data: uploadRows },
    { data: dayRows },
    standings,
    { data: pgRows },
    journalRows,
  ] = await Promise.all([
    supabase
      .from("goals")
      .select("id, title, unit, target_value, current_value, current_status")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single(),
    supabase
      .from("uploads")
      .select("id, file_name, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
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
  if (!goal) redirect("/welcome");

  const profile = me as { full_name: string | null; avatar_url: string | null } | null;
  const name = profile?.full_name || "Rider";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const uploads = (uploadRows ?? []) as Upload[];
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
  const months = monthly(days);
  const scoredAll = days.filter((d) => d.score != null).map((d) => d.score as number);
  const allAvg = scoredAll.length ? round1(scoredAll.reduce((a, b) => a + b, 0) / scoredAll.length) : null;
  const firstDay = days.find((d) => d.score != null)?.day ?? null;
  const lastUpload = uploads[0] ? shortDate(uploads[0].created_at.slice(0, 10)) : null;

  return (
    <main className={s.page}>
      <NavBar active="me" />
      <header className={s.head}>
        <div className={s.who}>
          <div
            className={s.avatar}
            style={profile?.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : undefined}
          >
            {profile?.avatar_url ? null : initials}
          </div>
          <div>
            <div className="eyebrow">My Zone</div>
            <h1>{name}</h1>
            <p className={s.sub}>
              {view === "all"
                ? allAvg != null && firstDay
                  ? `All time · avg ${allAvg} over ${scoredAll.length} scored days since ${shortDate(firstDay)} ${firstDay.slice(0, 4)}`
                  : "No WHOOP history yet — upload your export."
                : mine
                  ? `${ordinal(rank)} of ${standings.length} · race avg ${mine.avg} · ${mine.days} scored days · ${mine.missed} missed`
                  : "Not on the board yet — upload your WHOOP export."}
            </p>
            <div className={`seg ${s.viewToggle}`}>
              <Link href="/me" className={`seg-btn ${view === "contest" ? "on" : ""}`}>Contest</Link>
              <Link href="/me?view=all" className={`seg-btn ${view === "all" ? "on" : ""}`}>All time</Link>
            </div>
          </div>
        </div>
        <div className={s.actions}>
          <details className={s.upload} open={params.upload != null}>
            <summary className="btn-ghost">{lastUpload ? `Upload · last ${lastUpload}` : "Upload WHOOP data"}</summary>
            <div className={s.uploadPanel}>
              <UploadWhoop userId={user.id} uploads={uploads} />
            </div>
          </details>
          <SignOutButton />
        </div>
      </header>

      <div className={s.row1}>
        <section className="zone-card">
          <h2>Latest day{latest ? ` · ${shortDate(latest.day)}` : ""}</h2>
          {latest ? (
            <>
              <div className={s.score}>
                <b>{latest.score}</b>
                {latest.delta != null && (
                  <span className={latest.delta >= 0 ? s.up : s.down}>
                    {signed(latest.delta)} vs your 30-day average
                  </span>
                )}
              </div>
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
            <p className="trend-empty">No scored days yet — upload your WHOOP export.</p>
          )}
        </section>

        {view === "all" ? (
        <section className="zone-card">
          <h2>Monthly averages</h2>
          {months.length === 0 ? (
            <p className="trend-empty">No scored days yet — upload your WHOOP export.</p>
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
                title={`${shortDate(c.day)} · ${c.score != null ? c.score : c.state === "missed" ? "missed" : "not uploaded yet"}`}
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
      </div>

      <div className={s.row2}>
        <div className={s.side}>
          <section className="zone-card">
            <h2>{view === "all" ? "Trends · last 7 days vs all time" : "Trends · last 7 vs 30 days"}</h2>
            {days.length === 0 ? (
              <p className="trend-empty">No data yet — upload your WHOOP export.</p>
            ) : (
              <>
                <div className={`${s.trow} ${s.thead}`}>
                  <span className={s.tlabel} />
                  <span className={s.tbars}>{view === "all" ? "26 weeks" : "30 days"}</span>
                  <span className={s.t7}>7d</span>
                  <span className={s.t30}>{view === "all" ? "all" : "30d"}</span>
                  <span className={s.tdelta}>trend</span>
                </div>
                {trendRows.map((t) => {
                  const vals = t.bars.filter((v): v is number => v != null);
                  const min = Math.min(...vals);
                  const range = Math.max(...vals) - min || 1;
                  return (
                    <details className={s.tdetails} key={t.key}>
                      <summary className={s.trow}>
                        <span className={s.tlabel}>{t.label}</span>
                        <span className={s.tbars} aria-hidden>
                          {t.bars.map((v, i) => (
                            <i
                              key={i}
                              className={i >= t.bars.length - (view === "all" ? 1 : 7) ? s.recent : undefined}
                              style={{ height: v == null ? "2px" : `${20 + ((v - min) / range) * 80}%` }}
                            />
                          ))}
                        </span>
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
              </>
            )}
          </section>

        <section className={`zone-card ${s.journal}`}>
          <h2>Journal insights · {view === "all" ? "last 6 months" : "last 3 months"}</h2>
          <p className={s.note}>How your WHOOP journal answers line up with the next morning&apos;s recovery and sleep.</p>
          {impacts.length === 0 ? (
            <p className="trend-empty">
              Not enough journal answers yet — keep answering the WHOOP journal each morning and upload your export.
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

        <div className={s.side}>
          <section className="zone-card">
            <h2>Business goal</h2>
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
          </section>

          <section className="zone-card">
            <h2>Extra Credit</h2>
            <ExtraCredit goals={personalGoals} />
          </section>
        </div>
      </div>

    </main>
  );
}
