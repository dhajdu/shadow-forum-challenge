"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { error: string | null; ok: boolean };

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in.", ok: false };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim() || null;
  if (!fullName) return { error: "Name can't be empty.", ok: false };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, avatar_url: avatarUrl })
    .eq("id", user.id);
  if (error) return { error: error.message, ok: false };

  revalidatePath("/profile");
  return { error: null, ok: true };
}

export async function changePassword(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 6) return { error: "Password must be at least 6 characters.", ok: false };
  if (password !== confirm) return { error: "Passwords don't match.", ok: false };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message, ok: false };
  return { error: null, ok: true };
}
