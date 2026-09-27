"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createRiderGoal } from "@/lib/goals";

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

  const targetRaw = formData.get("target_value");
  const error = await createRiderGoal(supabase, user.id, {
    title: String(formData.get("title") ?? ""),
    unit: String(formData.get("unit") ?? "").trim() || null,
    targetValue: targetRaw != null && String(targetRaw).trim() !== "" ? Number(targetRaw) : null,
    targetDate: String(formData.get("target_date") ?? "").trim() || null,
  });
  // one locked goal per rider — an existing goal just goes to the race
  if (error && error !== "exists") return { error };

  redirect("/race");
}
