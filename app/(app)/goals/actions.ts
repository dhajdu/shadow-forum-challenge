"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getForumContext } from "@/app/_data/context";

// personal_goals with season_id: any number of goals per member per quarter, owner-only under RLS.
async function db() {
  const ctx = await getForumContext();
  return { db: ctx.db as unknown as SupabaseClient, userId: ctx.user.id };
}

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export async function addGoal(form: FormData): Promise<void> {
  const { db: d, userId } = await db();
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  const season_id = String(form.get("season_id") ?? "");
  if (!title || !season_id) return;
  await d.from("personal_goals").insert({
    user_id: userId,
    season_id,
    title,
    unit: String(form.get("unit") ?? "").trim().slice(0, 40) || null,
    target_value: num(form.get("target_value")),
    current_value: 0,
  });
  revalidatePath("/goals");
}

export async function updateGoal(form: FormData): Promise<void> {
  const { db: d, userId } = await db();
  const id = String(form.get("id") ?? "");
  const current_value = num(form.get("current_value"));
  if (!id || current_value == null) return;
  await d.from("personal_goals").update({ current_value }).eq("id", id).eq("user_id", userId);
  revalidatePath("/goals");
}

export async function deleteGoal(form: FormData): Promise<void> {
  const { db: d, userId } = await db();
  const id = String(form.get("id") ?? "");
  if (!id) return;
  await d.from("personal_goals").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/goals");
}
