import { getForumContext } from "@/app/_data/context";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

// Every signed-in section (Forum, Contest, Ask, Me) sits in the shell. Home is "/", see app/page.tsx.
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const { viewer } = await getForumContext(); // redirects to "/" when signed out
  return <AppShell isAdmin={viewer.is_admin}>{children}</AppShell>;
}
