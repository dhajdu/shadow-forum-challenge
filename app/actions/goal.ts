"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileCoaches } from "@/lib/coach";

export type GoalFormState = { error: string | null };

export async function createGoal(
  _prev: GoalFormState,
  formData: FormData
): Promise<GoalFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const title = String(formData.get("title") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim() || null;
  const targetRaw = formData.get("target_value");
  const targetValue = targetRaw != null && String(targetRaw).trim() !== "" ? Number(targetRaw) : null;
  const targetDate = String(formData.get("target_date") ?? "").trim() || null;

  if (!title) return { error: "Your goal can't be empty." };
  if (targetValue != null && Number.isNaN(targetValue)) return { error: "Target must be a number." };

  // one locked goal per rider — refuse if one already exists
  const { data: existing } = await supabase
    .from("goals")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) redirect("/race");

  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    title,
    unit,
    target_value: targetValue,
    current_value: 0,
    target_date: targetDate,
    coach_id: null, // assigned from the roster below
    locked: true,
  });

  if (error) return { error: error.message };

  // auto-assign coaches from the roster (this goal + backfill any now-linkable)
  await reconcileCoaches(createAdminClient());

  redirect("/race");
}
