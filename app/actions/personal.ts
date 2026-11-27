"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function client() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function addPersonalGoal(formData: FormData): Promise<void> {
  const { supabase, user } = await client();
  if (!user) return;
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const unit = String(formData.get("unit") ?? "").trim() || null;
  const targetRaw = formData.get("target_value");
  const target_value = targetRaw != null && String(targetRaw).trim() !== "" ? Number(targetRaw) : null;
  await supabase.from("personal_goals").insert({ user_id: user.id, title, unit, target_value, current_value: 0 });
  revalidatePath("/me");
}

export async function updatePersonalGoal(formData: FormData): Promise<void> {
  const { supabase, user } = await client();
  if (!user) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const current_value = Number(formData.get("current_value") ?? 0);
  if (Number.isNaN(current_value)) return;
  await supabase.from("personal_goals").update({ current_value }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/me");
}

export async function deletePersonalGoal(formData: FormData): Promise<void> {
  const { supabase, user } = await client();
  if (!user) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("personal_goals").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/me");
}
