import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, GoalStatus } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileCoaches } from "@/lib/coach";

export const GOAL_STATUSES: GoalStatus[] = ["on_track", "at_risk", "behind", "hit"];

export function goalPct(current: number, target: number | null): number {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

export type GoalMeasure = {
  currentValue: number;
  targetValue: number | null;
  unit: string | null;
  status: GoalStatus;
  note: string | null;
};

/**
 * Update the rider's measurable business goal: current value, target, unit, status,
 * note. Percentage complete is derived from current / target; the note goes to the
 * append-only progress log the coach reads. Returns an error message or null.
 */
export async function saveGoalMeasure(
  supabase: SupabaseClient<Database>,
  userId: string,
  m: GoalMeasure
): Promise<string | null> {
  const { data: goal } = await supabase.from("goals").select("id").eq("user_id", userId).maybeSingle();
  const g = goal as { id: string } | null;
  if (!g) return "No goal to update.";

  if (Number.isNaN(m.currentValue)) return "Current must be a number.";
  if (m.targetValue != null && Number.isNaN(m.targetValue)) return "Target must be a number.";
  if (!GOAL_STATUSES.includes(m.status)) return "Invalid status.";

  const progress = goalPct(m.currentValue, m.targetValue);
  const { error } = await supabase
    .from("goals")
    .update({
      current_value: m.currentValue,
      target_value: m.targetValue,
      unit: m.unit,
      current_progress: progress,
      current_status: m.status,
    })
    .eq("id", g.id);
  if (error) return error.message;

  await supabase.from("goal_progress").insert({ goal_id: g.id, progress, status: m.status, note: m.note });
  return null;
}

export type NewGoal = { title: string; unit: string | null; targetValue: number | null; targetDate: string | null };

/**
 * Create the rider's one locked Q4 goal and assign their coach from the roster.
 * Returns "exists" if they already have one, another error message, or null.
 */
export async function createRiderGoal(
  supabase: SupabaseClient<Database>,
  userId: string,
  g: NewGoal
): Promise<string | null> {
  if (!g.title.trim()) return "Your goal can't be empty.";
  if (g.targetValue != null && Number.isNaN(g.targetValue)) return "Target must be a number.";

  const { data: existing } = await supabase.from("goals").select("id").eq("user_id", userId).maybeSingle();
  if (existing) return "exists";

  const { error } = await supabase.from("goals").insert({
    user_id: userId,
    title: g.title.trim(),
    unit: g.unit,
    target_value: g.targetValue,
    current_value: 0,
    target_date: g.targetDate,
    coach_id: null, // assigned from the roster below
    locked: true,
  });
  if (error) return error.message;

  // auto-assign coaches from the roster (this goal + backfill any now-linkable)
  await reconcileCoaches(createAdminClient());
  return null;
}
