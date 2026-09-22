import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware already guards this, but never render without a user
  if (!user) redirect("/");

  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const profile = data as { full_name: string | null } | null;
  const name = profile?.full_name || user.email;

  return (
    <main className="wrap">
      <div className="hero" />
      <div className="scrim" />
      <section className="panel">
        <div className="eyebrow">Inside</div>
        <h1 className="title">Welcome</h1>
        <p className="tagline">{name}</p>
        <SignOutButton />
      </section>
    </main>
  );
}
