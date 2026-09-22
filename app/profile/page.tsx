import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";
import { ProfileForm } from "@/components/ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data } = await supabase
    .from("profiles")
    .select("full_name, email, avatar_url")
    .eq("id", user.id)
    .single();
  const profile = data as { full_name: string; email: string | null; avatar_url: string | null } | null;

  return (
    <main className="zone">
      <NavBar />
      <header className="zone-head">
        <div>
          <div className="eyebrow">
            <Link href="/me" className="back">← My Zone</Link>
          </div>
          <h1>Profile</h1>
        </div>
      </header>

      <ProfileForm
        userId={user.id}
        fullName={profile?.full_name ?? ""}
        email={profile?.email ?? user.email ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
      />
    </main>
  );
}
