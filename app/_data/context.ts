import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { getForumSettings } from "@/lib/forum-settings";
import { getViewer } from "./forum";
import { todayIn } from "./format";

/** The member's own Supabase client, forum standing and the forum's settings, once per request. */
export const getForumContext = cache(async () => {
  const db = await createClient();
  const user = await getSessionUser(db);
  if (!user) redirect("/");
  const [viewer, forum] = await Promise.all([getViewer(db, user.id), getForumSettings()]);
  return { db, user, viewer, forum, today: todayIn(forum.timeZone) };
});
