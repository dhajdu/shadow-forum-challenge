import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStandings } from "@/lib/standings";
import { RaceBoard } from "@/components/RaceBoard";
import { NavBar } from "@/components/NavBar";
import { dayOfContest, currentLeg, CONTEST_DAYS, PLACEMENT_PENALTIES } from "@/lib/contest";
import { coachingPairs } from "@/lib/roster";
import type { GoalStatus } from "@/lib/database.types";

const STATUS_LABEL: Record<GoalStatus, string> = {
  on_track: "on track",
  at_risk: "at risk",
  behind: "behind",
  hit: "hit",
};

export default async function RacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: goal } = await supabase
    .from("goals")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!goal) redirect("/welcome");

  const standings = await getStandings(supabase);

  // business goals + public status (denormalized on goals, readable by all)
  const { data: goals } = await supabase
    .from("goals")
    .select("id, user_id, title, current_status");

  const nameById = new Map(standings.map((s) => [s.user_id, s.full_name]));
  const goalList = (
    (goals ?? []) as { id: string; user_id: string; title: string; current_status: GoalStatus }[]
  ).map((g) => ({
    ...g,
    rider: nameById.get(g.user_id) ?? "Rider",
    status: g.current_status,
  }));

  const kitty = PLACEMENT_PENALTIES.reduce((a, b) => a + b, 0);

  return (
    <main className="app">
      <NavBar active="race" />

      <div className="race-head">
        <div>
          <div className="eyebrow">Q4 2026 · <span className="live">● live</span></div>
          <h1>Race Into the Shadow</h1>
          <p className="sub">Highest average WHOOP score leads. Deepest into the shadow pays nothing.</p>
        </div>
        <div className="kpis">
          <div className="kpi"><b>{dayOfContest()}</b><span>day of {CONTEST_DAYS}</span></div>
          <div className="kpi k-kitty"><b>{kitty}M</b><span>kitty</span></div>
          <div className="kpi"><b>{standings.length}</b><span>riders</span></div>
          <div className="kpi"><b>{currentLeg()}</b><span>current leg</span></div>
        </div>
      </div>

      <RaceBoard standings={standings} />

      <section className="card goals-card">
        <h3>Business goals — Q4</h3>
        <div className="glist">
          {goalList.length === 0 && <p className="dim">No goals set yet.</p>}
          {goalList.map((g) => (
            <div className="goal" key={g.id}>
              <div className="gi" />
              <div className="gt">
                {g.rider}
                <small>{g.title}</small>
              </div>
              <span className={`chip ${g.status}`}>{STATUS_LABEL[g.status]}</span>
            </div>
          ))}
        </div>
        <div className="board-foot">Hit → pay 0 · miss → 5M rider + 5M coach into the kitty.</div>
      </section>

      <section className="card goals-card">
        <h3>Coaching pairings</h3>
        <table className="ladder">
          <thead>
            <tr><th>Rider</th><th>Coached by</th></tr>
          </thead>
          <tbody>
            {coachingPairs().map((p) => (
              <tr key={p.rider}>
                <td>{p.rider}</td>
                <td>{p.coach}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="board-foot">Coaches are assigned — nobody picks their own, and no two coach each other.</div>
      </section>
    </main>
  );
}
