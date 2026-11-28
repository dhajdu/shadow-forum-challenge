import { redirect } from "next/navigation";
import { getForumSettings } from "@/lib/forum-settings";

// Biometrics is the WHOOP health track; it is off unless the forum switches it on (Forum settings).
export default async function BiometricsLayout({ children }: { children: React.ReactNode }) {
  if (!(await getForumSettings()).whoopEnabled) redirect("/");
  return children;
}
