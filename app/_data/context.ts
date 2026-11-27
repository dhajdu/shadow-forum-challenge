import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { getViewer } from "./forum";
import { todayVN } from "./format";

/** The member's own Supabase client and forum standing, once per request. */
export const getForumContext = cache(async () => {
  const db = await createClient();
  const user = await getSessionUser(db);
  if (!user) redirect("/");
  const viewer = await getViewer(db, user.id);
  return { db, user, viewer, today: todayVN() };
});
