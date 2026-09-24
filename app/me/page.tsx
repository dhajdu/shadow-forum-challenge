import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";
import { UploadWhoop } from "@/components/UploadWhoop";
import { MyData, type WhoopDay } from "@/components/MyData";
import { GoalProgress } from "@/components/GoalProgress";
import { ExtraCredit, type PersonalGoal } from "@/components/ExtraCredit";
import { SignOutButton } from "@/components/SignOutButton";
import { getStandings } from "@/lib/standings";
import { CONTEST_START_DAY } from "@/lib/contest";
import { coachNameFor } from "@/lib/roster";
import type { GoalStatus } from "@/lib/database.types";

type Upload = { id: string; file_name: string; status: string; created_at: string };

export default async function MyZone() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: goalRow } = await supabase
    .from("goals")
    .select("id, title, unit, target_value, current_value, current_status")
    .eq("user_id", user.id)
    .maybeSingle();
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
    .select("day, score, recovery, sleep, strain, resting_hr, hrv, missed")
    .eq("user_id", user.id)
    .order("day", { ascending: true });
  const days = (dayRows ?? []) as WhoopDay[];

  const standings = await getStandings(supabase);
  const rank = standings.findIndex((s) => s.user_id === user.id) + 1;

  const { data: pgRows } = await supabase
    .from("personal_goals")
    .select("id, title, unit, target_value, current_value")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  const personalGoals = (pgRows ?? []) as PersonalGoal[];

  return (
    <main className="zone">
      <NavBar active="me" />
      <header className="zone-head">
        <div>
          <div className="eyebrow">My Zone</div>
          <h1>{name}</h1>
        </div>
        <div className="zone-nav">
          <SignOutButton />
        </div>
      </header>

      <section className="zone-card">
        <h2>My data</h2>
        <MyData
          days={days}
          contestStartDay={CONTEST_START_DAY}
          rank={rank}
          riderCount={standings.length}
        />
      </section>

      <section className="zone-card">
        <h2>Business goal progress</h2>
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

      <section className="zone-card">
        <h2>Upload WHOOP data</h2>
        <UploadWhoop userId={user.id} uploads={uploads} />
      </section>
    </main>
  );
}
