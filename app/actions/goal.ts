"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  const measure = String(formData.get("measure") ?? "").trim() || null;
  const targetDate = String(formData.get("target_date") ?? "").trim() || null;
  const coachId = String(formData.get("coach_id") ?? "").trim() || null;

  if (!title) return { error: "Your goal can't be empty." };

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
    measure,
    target_date: targetDate,
    coach_id: coachId,
    locked: true,
  });

  if (error) return { error: error.message };

  redirect("/race");
}
