import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/OnboardingForm";

export default async function Welcome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // already onboarded? skip.
  const { data: goal } = await supabase
    .from("goals")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (goal) redirect("/race");

  const { data: me } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();
  const name = (me as { full_name: string | null } | null)?.full_name || "";

  return (
    <main className="wrap">
      <div className="hero" />
      <div className="scrim" />
      <section className="panel onboard">
        <div className="eyebrow">First time in</div>
        <h1 className="title">Welcome, Rider</h1>
        <p className="tagline">Lock in your Q4 goal</p>
        <OnboardingForm name={name} />
      </section>
    </main>
  );
}
