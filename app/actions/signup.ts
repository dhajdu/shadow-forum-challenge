"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SignUpResult = {
  error: string | null;
  session: boolean; // true when signed in and ready to enter
};

// Gated sign-up — requires the shared access code (verified server-side).
// Creates the account already confirmed and signs the rider straight in, so
// there is no email-confirmation step.
export async function signUpWithCode(formData: FormData): Promise<SignUpResult> {
  const code = String(formData.get("code") ?? "").trim();
  const expected = process.env.SIGNUP_ACCESS_CODE;
  if (!expected || code !== expected) {
    return { error: "Invalid access code.", session: false };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!name || !email || password.length < 6) {
    return { error: "Enter your name, email, and a password of at least 6 characters.", session: false };
  }

  // create the user already email-confirmed (no confirmation step)
  const admin = createAdminClient();
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (createErr) {
    const msg = /already/i.test(createErr.message)
      ? "That email is already registered — sign in instead."
      : createErr.message;
    return { error: msg, session: false };
  }

  // sign them straight in (sets the session cookie)
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) return { error: signInErr.message, session: false };

  return { error: null, session: true };
}
