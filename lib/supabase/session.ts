import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Set by middleware after it verifies the session with Supabase.
export const USER_ID_HEADER = "x-sf-user-id";
export const USER_EMAIL_HEADER = "x-sf-user-email";

export type SessionUser = { id: string; email: string | null };

/**
 * The signed-in user, as already verified by middleware on this request — saves a
 * second round trip to Supabase Auth. Falls back to asking Supabase if the header
 * isn't there (e.g. a route the middleware doesn't cover).
 */
export async function getSessionUser(supabase: SupabaseClient<Database>): Promise<SessionUser | null> {
  const h = await headers();
  const id = h.get(USER_ID_HEADER);
  if (id) return { id, email: h.get(USER_EMAIL_HEADER) };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}
