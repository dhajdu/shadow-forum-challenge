"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { GoalStatus } from "@/lib/database.types";

export type ProgressState = { error: string | null; ok: boolean };

const STATUSES: GoalStatus[] = ["on_track", "at_risk", "behind", "hit"];

function pct(current: number, target: number | null): number {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

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

  const { data: goal } = await supabase
    .from("goals")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  const g = goal as { id: string } | null;
  if (!g) return { error: "No goal to update.", ok: false };

  const currentValue = Number(formData.get("current_value") ?? 0);
  const targetRaw = formData.get("target_value");
  const targetValue = targetRaw != null && String(targetRaw).trim() !== "" ? Number(targetRaw) : null;
  const unit = String(formData.get("unit") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "on_track") as GoalStatus;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (Number.isNaN(currentValue)) return { error: "Current must be a number.", ok: false };
  if (targetValue != null && Number.isNaN(targetValue)) return { error: "Target must be a number.", ok: false };
  if (!STATUSES.includes(status)) return { error: "Invalid status.", ok: false };

  const progress = pct(currentValue, targetValue);

  const { error } = await supabase
    .from("goals")
    .update({
      current_value: currentValue,
      target_value: targetValue,
      unit,
      current_progress: progress,
      current_status: status,
    })
    .eq("id", g.id);
  if (error) return { error: error.message, ok: false };

  // append-only progress log (keeps the coach note history)
  await supabase.from("goal_progress").insert({ goal_id: g.id, progress, status, note });

  revalidatePath("/me");
  revalidatePath("/race");
  return { error: null, ok: true };
}
