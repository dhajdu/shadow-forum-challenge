import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { getForumContext } from "@/app/_data/context";
import { AppShell } from "@/components/AppShell";
import { Landing } from "@/components/Landing";
import { HomeView } from "@/app/_home/HomeView";

export const dynamic = "force-dynamic";

// Signed out: the neon landing page. Signed in: Home, inside the app shell.
export default async function Root() {
  const user = await getSessionUser(await createClient());
  if (!user) return <Landing />;
  const { viewer } = await getForumContext();
  return (
    <AppShell isAdmin={viewer.is_admin}>
      <HomeView />
    </AppShell>
  );
}
