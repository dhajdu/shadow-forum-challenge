"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { saveGoalMeasure } from "@/lib/goals";
import type { GoalStatus } from "@/lib/database.types";

export type ProgressState = { error: string | null; ok: boolean };

// Update the measurable business goal: current value, target, unit, status, note.
// Percentage complete is derived from current / target.
export async function updateGoalMeasure(
  _prev: ProgressState,
  formData: FormData
): Promise<ProgressState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in.", ok: false };

  const targetRaw = formData.get("target_value");
  const error = await saveGoalMeasure(supabase, user.id, {
    currentValue: Number(formData.get("current_value") ?? 0),
    targetValue: targetRaw != null && String(targetRaw).trim() !== "" ? Number(targetRaw) : null,
    unit: String(formData.get("unit") ?? "").trim() || null,
    status: String(formData.get("status") ?? "on_track") as GoalStatus,
    note: String(formData.get("note") ?? "").trim() || null,
  });
  if (error) return { error, ok: false };

  revalidatePath("/me");
  revalidatePath("/race");
  return { error: null, ok: true };
}
