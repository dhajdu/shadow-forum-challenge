import { getForumContext } from "@/app/_data/context";
import { contestSeason as seasonForToday } from "@/app/_data/season";
import { moneyShort } from "@/app/_data/kitty";
import { rulesOf } from "@/lib/goal-points";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/OnboardingForm";
import { getSessionUser } from "@/lib/supabase/session";
import { coachNameFor } from "@/lib/roster";

export default async function Welcome() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/");
  const { viewer, forum } = await getForumContext();
  const season = await seasonForToday(supabase, viewer);
  const contestSeason = season?.id ?? null;
  const rules = rulesOf(season);
  const stake = [rules.missedGoalFine && `${moneyShort(rules.missedGoalFine, forum.currency)} you`, rules.coachShareFine && `${moneyShort(rules.coachShareFine, forum.currency)} coach`]
    .filter(Boolean)
    .join(" + ");

  const [{ data: goal }, { data: me }] = await Promise.all([
    supabase.from("goals").select("id").eq("user_id", user.id).eq("season_id", contestSeason ?? "").maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);
  // already onboarded? skip.
  if (goal) redirect("/contest");

  const name = (me as { full_name: string | null } | null)?.full_name || "";

  return (
    <main className="wrap">
      <div className="hero" />
      <div className="scrim" />
      <section className="panel onboard">
        <div className="eyebrow">First time in</div>
        <h1 className="title">Welcome, Rider</h1>
        <p className="tagline">Lock in your {season?.name ?? ""} goal</p>
        <OnboardingForm name={name} coach={coachNameFor(user.id, forum)} seasonName={season?.name ?? ""} endsOn={season?.ends_on ?? null} stake={stake || null} />
      </section>
    </main>
  );
}
