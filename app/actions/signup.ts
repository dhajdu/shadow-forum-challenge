"use server";

import { createClient } from "@/lib/supabase/server";
import { createRider } from "@/lib/signup";

export type SignUpResult = {
  error: string | null;
  session: boolean; // true when signed in and ready to enter
};

// Gated sign-up — requires the shared access code (verified server-side).
// Creates the account already confirmed and signs the rider straight in, so
// there is no email-confirmation step.
export async function signUpWithCode(formData: FormData): Promise<SignUpResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const error = await createRider({
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
    email,
    password,
  });
  if (error) return { error, session: false };

  // sign them straight in (sets the session cookie)
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) return { error: signInErr.message, session: false };

  return { error: null, session: true };
}
