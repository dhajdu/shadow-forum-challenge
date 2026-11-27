"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { disconnectUser } from "@/lib/whoop/sync";

/** Revoke the member's WHOOP grant and delete the stored tokens. */
export async function disconnectWhoop(): Promise<void> {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return;
  await disconnectUser(createAdminClient(), user.id);
  revalidatePath("/me");
}
