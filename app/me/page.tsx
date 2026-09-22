import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UploadWhoop } from "@/components/UploadWhoop";
import { SignOutButton } from "@/components/SignOutButton";

type Upload = { id: string; file_name: string; status: string; created_at: string };

export default async function MyZone() {
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

  return (
    <main className="zone">
      <header className="zone-head">
        <div>
          <div className="eyebrow">My Zone</div>
          <h1>{name}</h1>
        </div>
        <SignOutButton />
      </header>

      <section className="zone-card">
        <h2>Upload WHOOP data</h2>
        <UploadWhoop userId={user.id} uploads={uploads} />
      </section>
    </main>
  );
}
