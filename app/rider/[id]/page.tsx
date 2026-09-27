import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ScoreTrend } from "@/components/ScoreTrend";
import { NavBar } from "@/components/NavBar";
import { getStandings } from "@/lib/standings";
import type { GoalStatus } from "@/lib/database.types";
import { getSessionUser } from "@/lib/supabase/session";
import { CONTEST_START_DAY } from "@/lib/contest";
import { STRAIN_MAX } from "@/lib/whoop/parse";
import styles from "./rider.module.css";

const STATUS_LABEL: Record<GoalStatus, string> = {
  on_track: "on track",
  at_risk: "at risk",
  behind: "behind",
  hit: "hit",
};

type Day = { day: string; score: number | null; recovery: number | null; sleep: number | null; strain: number | null };

export default async function RiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/");

  // independent reads — run them together
  const [{ data: prof }, { data: dayRows }, { data: goalRow }, standings] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url").eq("id", id).maybeSingle(),
    supabase.from("whoop_days").select("day, score, recovery, sleep, strain").eq("user_id", id).order("day", { ascending: true }),
    supabase
      .from("goals")
      .select("id, title, unit, target_value, current_value, current_status, current_progress")
      .eq("user_id", id)
      .maybeSingle(),
    getStandings(supabase),
  ]);

  const profile = prof as { full_name: string; avatar_url: string | null } | null;
  if (!profile) notFound();

  const days = (dayRows ?? []) as Day[];
  const scored = days.filter((d) => d.score != null) as { score: number }[];
  const recoveries = days.filter((d) => d.recovery != null).map((d) => d.recovery as number);
  const latestRecovery = recoveries.length ? recoveries[recoveries.length - 1] : null;

  const goal = goalRow as
    | {
        id: string; title: string; unit: string | null; target_value: number | null;
        current_value: number; current_status: GoalStatus; current_progress: number;
      }
    | null;

  // coaching notes (needs the goal id) — RLS returns rows only if the viewer is the owner or coach
  const { data: noteRows } = goal
    ? await supabase
        .from("coaching_notes")
        .select("body, session_month, created_at")
        .eq("goal_id", goal.id)
        .order("created_at", { ascending: false })
    : { data: [] };
  const notes = (noteRows ?? []) as { body: string; session_month: string | null; created_at: string }[];

  const rank = standings.findIndex((s) => s.user_id === id) + 1;
  const me = standings[rank - 1];
  const avg = me && me.days > 0 ? me.avg : null;

  // Every contest day from the start to the newest uploaded day, newest first.
  // Mirrors the race rules: complete days score (recovery + sleep + strain%) ÷ 3,
  // the newest day counts with what it has, anything else unscored is a missed day.
  const byDay = new Map(days.map((d) => [d.day, d]));
  const newestDay = days.length ? days[days.length - 1].day : null;
  const contestRows: { day: string; d: Day | undefined; status: "scored" | "in progress" | "missed" }[] = [];
  if (newestDay && newestDay >= CONTEST_START_DAY) {
    for (let t = Date.parse(newestDay); t >= Date.parse(CONTEST_START_DAY); t -= 86_400_000) {
      const day = new Date(t).toISOString().slice(0, 10);
      const d = byDay.get(day);
      const complete = d && d.recovery != null && d.sleep != null && d.strain != null;
      const status = d?.score == null ? "missed" : complete ? "scored" : "in progress";
      contestRows.push({ day, d, status });
    }
  }
  const strainPct = (s: number) => Math.round(Math.min(100, (s / STRAIN_MAX) * 100));

  return (
    <main className="app">
      <NavBar active="race" />

      <Link href="/race" className="back">← back to race</Link>

      <div className="rider-head">
        <div className="avatar-lg" style={profile.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : undefined} />
        <div>
          <h1>{profile.full_name}</h1>
          <p className="sub">Rank {rank > 0 ? `#${rank}` : "—"} · race avg {avg ?? "—"}</p>
        </div>
      </div>

      <section className="card">
        <div className="kpi-row">
          <div className="kpi"><b>{avg ?? "—"}</b><span>race avg</span></div>
          <div className="kpi"><b>{me?.days ?? 0}</b><span>scored days</span></div>
          <div className="kpi"><b>{me?.missed ?? 0}</b><span>missed</span></div>
          <div className="kpi"><b>{latestRecovery ?? "—"}</b><span>recovery</span></div>
          <div className="kpi"><b>{rank > 0 ? `#${rank}` : "—"}</b><span>of {standings.length}</span></div>
        </div>
        <div className="trend-wrap"><ScoreTrend scores={scored.map((d) => d.score)} /></div>
        <p className={styles.caption}>All uploaded history</p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Daily scores — contest</h3>
        <p className={styles.formula}>
          Day score = (Recovery % + Sleep % + Strain ÷ {STRAIN_MAX} × 100) ÷ 3 · Race avg = average of scored days since{" "}
          {new Date(CONTEST_START_DAY).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}.
          The newest day, if still in progress, averages the numbers it has until the next upload.
        </p>
        {contestRows.length === 0 ? (
          <p className="dim">No contest days uploaded yet.</p>
        ) : (
          <table className="ladder">
            <thead>
              <tr>
                <th>Day</th>
                <th className="r">Recovery</th>
                <th className="r">Sleep</th>
                <th className="r">Strain</th>
                <th className="r">Score</th>
              </tr>
            </thead>
            <tbody>
              {contestRows.map(({ day, d, status }) => (
                <tr key={day} className={status === "missed" ? styles.missed : undefined}>
                  <td>
                    {new Date(day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                    {status !== "scored" && <span className={styles.tag}>{status}</span>}
                  </td>
                  <td className="r">{d?.recovery != null ? `${d.recovery}%` : "—"}</td>
                  <td className="r">{d?.sleep != null ? `${d.sleep}%` : "—"}</td>
                  <td className="r">
                    {d?.strain != null ? (
                      <>
                        {d.strain} <small className={styles.dim}>→ {strainPct(d.strain)}%</small>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="r amt">{d?.score ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Race avg · {me?.days ?? 0} scored days</td>
                <td className="r amt">{avg ?? "—"}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      {goal && (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Q4 business goal</h3>
          <div className="goal">
            <div className="gi" />
            <div className="gt">
              {goal.title}
              <small>
                {goal.target_value != null
                  ? `${goal.current_value}/${goal.target_value}${goal.unit ? ` ${goal.unit}` : ""} · ${goal.current_progress}%`
                  : `${goal.current_progress}% complete`}
              </small>
            </div>
            <span className={`chip ${goal.current_status}`}>{STATUS_LABEL[goal.current_status]}</span>
          </div>
        </section>
      )}

      {notes.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Coaching notes</h3>
          <ul className="notelist">
            {notes.map((n, i) => (
              <li key={i}>
                <span className="note-when">{n.session_month ?? n.created_at.slice(0, 10)}</span>
                {n.body}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
