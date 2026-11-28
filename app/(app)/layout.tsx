import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getForumContext } from "@/app/_data/context";
import { mustSignConstitution, SIGN_PATH } from "@/app/_data/constitution";
import { PATH_HEADER } from "@/lib/supabase/session";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

// Every signed-in section (Forum, Contest, Ask, Me) sits in the shell. Home is "/", see app/page.tsx.
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const { db, user, viewer } = await getForumContext(); // redirects to "/" when signed out
  // Until a member signs the newest Constitution, the Constitution is the only page they can open.
  const path = (await headers()).get(PATH_HEADER) ?? "";
  if (!path.startsWith(SIGN_PATH) && (await mustSignConstitution(db, user.id))) redirect(`${SIGN_PATH}?sign=1#sign`);
  return <AppShell isAdmin={viewer.is_admin}>{children}</AppShell>;
}
