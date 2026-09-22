"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { GoalStatus } from "@/lib/database.types";

export type ProgressState = { error: string | null; ok: boolean };

const STATUSES: GoalStatus[] = ["on_track", "at_risk", "behind", "hit"];

export async function updateProgress(
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

  const progress = Math.max(0, Math.min(100, Number(formData.get("progress") ?? 0)));
  const status = String(formData.get("status") ?? "on_track") as GoalStatus;
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!STATUSES.includes(status)) return { error: "Invalid status.", ok: false };

  const { error } = await supabase.from("goal_progress").insert({
    goal_id: g.id,
    progress,
    status,
    note,
  });
  if (error) return { error: error.message, ok: false };

  // public snapshot on the goal (readable by all members for the race board)
  await supabase
    .from("goals")
    .update({ current_progress: progress, current_status: status })
    .eq("id", g.id);

  revalidatePath("/me");
  revalidatePath("/race");
  return { error: null, ok: true };
}
