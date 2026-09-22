"use server";

import { createClient } from "@/lib/supabase/server";

export type SignUpResult = {
  error: string | null;
  session: boolean; // true when signed in immediately (email confirmation off)
};

// Gated sign-up — requires the shared access code, verified server-side.
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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) return { error: error.message, session: false };

  return { error: null, session: !!data.session };
}
