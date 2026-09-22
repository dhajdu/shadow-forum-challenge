import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStandings } from "@/lib/standings";
import { RaceBoard } from "@/components/RaceBoard";
import { dayOfContest, currentLeg, CONTEST_DAYS, PLACEMENT_PENALTIES } from "@/lib/contest";
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

  // business goals + latest status per rider
  const { data: goals } = await supabase.from("goals").select("id, user_id, title");
  const { data: progress } = await supabase
    .from("goal_progress")
    .select("goal_id, status, created_at")
    .order("created_at", { ascending: false });

  const latestStatus = new Map<string, GoalStatus>();
  for (const p of (progress ?? []) as { goal_id: string; status: GoalStatus }[]) {
    if (!latestStatus.has(p.goal_id)) latestStatus.set(p.goal_id, p.status);
  }
  const nameById = new Map(standings.map((s) => [s.user_id, s.full_name]));
  const goalList = ((goals ?? []) as { id: string; user_id: string; title: string }[]).map((g) => ({
    ...g,
    rider: nameById.get(g.user_id) ?? "Rider",
    status: latestStatus.get(g.id) ?? ("on_track" as GoalStatus),
  }));

  const kitty = PLACEMENT_PENALTIES.reduce((a, b) => a + b, 0);

  return (
    <main className="app">
      <div className="bar">
        <div className="brand">THE SHADOW FORUM</div>
        <nav className="nav">
          <Link href="/race" className="on">Race</Link>
          <Link href="/me">My Zone</Link>
        </nav>
        <div className="spacer" />
        <Link href="/profile" className="av">◧</Link>
      </div>

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
    </main>
  );
}
