import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileCoaches } from "@/lib/coach";

export type NewRider = { code: string; name: string; email: string; password: string };

/**
 * Gated sign-up — checks the shared access code (server-side only) and creates the
 * account already email-confirmed. The caller signs the rider in afterwards.
 * Returns an error message, or null on success.
 */
export async function createRider({ code, name, email, password }: NewRider): Promise<string | null> {
  const expected = process.env.SIGNUP_ACCESS_CODE;
  if (!expected || code.trim() !== expected) return "Invalid access code.";

  name = name.trim();
  email = email.trim();
  if (!name || !email || password.length < 6) {
    return "Enter your name, email, and a password of at least 6 characters.";
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) {
    return /already/i.test(error.message) ? "That email is already registered — sign in instead." : error.message;
  }

  // backfill coach links now that this participant exists
  await reconcileCoaches(admin);
  return null;
}
