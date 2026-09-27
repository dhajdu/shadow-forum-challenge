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
import { getSessionUser } from "@/lib/supabase/session";

type Upload = { id: string; file_name: string; status: string; created_at: string };

export default async function MyZone() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/");

  // independent reads — run them together
  const [{ data: goalRow }, { data: me }, { data: uploadRows }, { data: dayRows }, standings, { data: pgRows }] =
    await Promise.all([
      supabase
        .from("goals")
        .select("id, title, unit, target_value, current_value, current_status")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
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

  const name = (me as { full_name: string | null } | null)?.full_name || "Rider";
  const uploads = (uploadRows ?? []) as Upload[];
  const days = (dayRows ?? []) as WhoopDay[];
  const rank = standings.findIndex((s) => s.user_id === user.id) + 1;
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
