import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, type SessionUser } from "@/lib/supabase/session";

export type AuthedRequest = { supabase: SupabaseClient<Database>; user: SessionUser };

/**
 * The signed-in caller of an API route, and a Supabase client that queries as them.
 * Web: the session cookie (verified by middleware). Native apps: an
 * `Authorization: Bearer <supabase access token>` header, verified with Supabase Auth.
 */
export async function getRequestUser(req: Request): Promise<AuthedRequest | null> {
  const auth = req.headers.get("authorization");
  const token = auth?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (token) {
    const supabase = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    return user ? { supabase, user: { id: user.id, email: user.email ?? null } } : null;
  }

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  return user ? { supabase, user } : null;
}
