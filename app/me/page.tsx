import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UploadWhoop } from "@/components/UploadWhoop";
import { ScoreTrend } from "@/components/ScoreTrend";
import { GoalProgress } from "@/components/GoalProgress";
import { SignOutButton } from "@/components/SignOutButton";
import { getStandings } from "@/lib/standings";
import type { GoalStatus } from "@/lib/database.types";

type Upload = { id: string; file_name: string; status: string; created_at: string };
type Day = { day: string; score: number | null; recovery: number | null; missed: boolean };

export default async function MyZone() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: goalRow } = await supabase
    .from("goals")
    .select("id, title, current_progress, current_status")
    .eq("user_id", user.id)
    .maybeSingle();
  const goal = goalRow as
    | { id: string; title: string; current_progress: number; current_status: GoalStatus }
    | null;
  if (!goal) redirect("/welcome");

  const { data: me } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();
  const name = (me as { full_name: string | null } | null)?.full_name || "Rider";

  const { data: uploadRows } = await supabase
    .from("uploads")
    .select("id, file_name, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const uploads = (uploadRows ?? []) as Upload[];

  const { data: dayRows } = await supabase
    .from("whoop_days")
    .select("day, score, recovery, missed")
    .eq("user_id", user.id)
    .order("day", { ascending: true });
  const days = (dayRows ?? []) as Day[];

  const scored = days.filter((d) => d.score != null) as { score: number }[];
  const avg = scored.length
    ? Math.round((scored.reduce((s, d) => s + d.score, 0) / scored.length) * 10) / 10
    : null;
  const recoveries = days.filter((d) => d.recovery != null).map((d) => d.recovery as number);
  const latestRecovery = recoveries.length ? recoveries[recoveries.length - 1] : null;
  const missed = days.filter((d) => d.missed).length;

  const standings = await getStandings(supabase);
  const rank = standings.findIndex((s) => s.user_id === user.id) + 1;

  return (
    <main className="zone">
      <header className="zone-head">
        <div>
          <div className="eyebrow">My Zone</div>
          <h1>{name}</h1>
        </div>
        <div className="zone-nav">
          <Link href="/profile" className="btn-ghost">Profile</Link>
          <SignOutButton />
        </div>
      </header>

      <section className="zone-card">
        <h2>My data</h2>
        <div className="kpi-row">
          <div className="kpi"><b>{avg ?? "—"}</b><span>avg score</span></div>
          <div className="kpi"><b>{latestRecovery ?? "—"}</b><span>recovery</span></div>
          <div className="kpi"><b>{days.length}</b><span>days logged</span></div>
          <div className="kpi"><b>{missed}</b><span>days missed</span></div>
          <div className="kpi"><b>{rank > 0 ? `#${rank}` : "—"}</b><span>of {standings.length}</span></div>
        </div>
        <div className="trend-wrap">
          <ScoreTrend scores={scored.map((d) => d.score)} />
        </div>
      </section>

      <section className="zone-card">
        <h2>Business goal progress</h2>
        <GoalProgress
          title={goal.title}
          currentProgress={goal.current_progress}
          currentStatus={goal.current_status}
        />
      </section>

      <section className="zone-card">
        <h2>Upload WHOOP data</h2>
        <UploadWhoop userId={user.id} uploads={uploads} />
      </section>
    </main>
  );
}
