import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ScoreTrend } from "@/components/ScoreTrend";
import { NavBar } from "@/components/NavBar";
import { getStandings } from "@/lib/standings";
import type { GoalStatus } from "@/lib/database.types";

const STATUS_LABEL: Record<GoalStatus, string> = {
  on_track: "on track",
  at_risk: "at risk",
  behind: "behind",
  hit: "hit",
};

type Day = { day: string; score: number | null; recovery: number | null };

export default async function RiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: prof } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", id)
    .maybeSingle();
  const profile = prof as { full_name: string; avatar_url: string | null } | null;
  if (!profile) notFound();

  const { data: dayRows } = await supabase
    .from("whoop_days")
    .select("day, score, recovery")
    .eq("user_id", id)
    .order("day", { ascending: true });
  const days = (dayRows ?? []) as Day[];
  const scored = days.filter((d) => d.score != null) as { score: number }[];
  const avg = scored.length
    ? Math.round((scored.reduce((s, d) => s + d.score, 0) / scored.length) * 10) / 10
    : null;
  const recoveries = days.filter((d) => d.recovery != null).map((d) => d.recovery as number);
  const latestRecovery = recoveries.length ? recoveries[recoveries.length - 1] : null;

  const { data: goalRow } = await supabase
    .from("goals")
    .select("id, title, unit, target_value, current_value, current_status, current_progress")
    .eq("user_id", id)
    .maybeSingle();
  const goal = goalRow as
    | {
        id: string; title: string; unit: string | null; target_value: number | null;
        current_value: number; current_status: GoalStatus; current_progress: number;
      }
    | null;

  // coaching notes — RLS returns rows only if the viewer is the owner or coach
  const { data: noteRows } = goal
    ? await supabase
        .from("coaching_notes")
        .select("body, session_month, created_at")
        .eq("goal_id", goal.id)
        .order("created_at", { ascending: false })
    : { data: [] };
  const notes = (noteRows ?? []) as { body: string; session_month: string | null; created_at: string }[];

  const standings = await getStandings(supabase);
  const rank = standings.findIndex((s) => s.user_id === id) + 1;

  return (
    <main className="app">
      <NavBar active="race" />

      <Link href="/race" className="back">← back to race</Link>

      <div className="rider-head">
        <div className="avatar-lg" style={profile.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : undefined} />
        <div>
          <h1>{profile.full_name}</h1>
          <p className="sub">Rank {rank > 0 ? `#${rank}` : "—"} · avg {avg ?? "—"}</p>
        </div>
      </div>

      <section className="card">
        <div className="kpi-row">
          <div className="kpi"><b>{avg ?? "—"}</b><span>avg score</span></div>
          <div className="kpi"><b>{latestRecovery ?? "—"}</b><span>recovery</span></div>
          <div className="kpi"><b>{days.length}</b><span>days</span></div>
          <div className="kpi"><b>{rank > 0 ? `#${rank}` : "—"}</b><span>of {standings.length}</span></div>
        </div>
        <div className="trend-wrap"><ScoreTrend scores={scored.map((d) => d.score)} /></div>
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
