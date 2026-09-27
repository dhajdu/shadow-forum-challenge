import { NextResponse, type NextRequest } from "next/server";
import { getRequestUser } from "@/lib/supabase/request";
import { createRiderGoal, saveGoalMeasure } from "@/lib/goals";
import type { GoalStatus } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** POST { title, unit?, targetValue?, targetDate? } — create the rider's Q4 goal (onboarding). */
export async function POST(req: NextRequest) {
  const auth = await getRequestUser(req);
  if (!auth) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const error = await createRiderGoal(auth.supabase, auth.user.id, {
    title: typeof b.title === "string" ? b.title : "",
    unit: text(b.unit),
    targetValue: num(b.targetValue),
    targetDate: text(b.targetDate),
  });
  if (error === "exists") return NextResponse.json({ error: "You already have a goal." }, { status: 409 });
  return NextResponse.json({ error }, { status: error ? 400 : 200 });
}

/** PATCH { currentValue, targetValue?, unit?, status, note? } — update goal progress. */
export async function PATCH(req: NextRequest) {
  const auth = await getRequestUser(req);
  if (!auth) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const error = await saveGoalMeasure(auth.supabase, auth.user.id, {
    currentValue: num(b.currentValue) ?? 0,
    targetValue: num(b.targetValue),
    unit: text(b.unit),
    status: (typeof b.status === "string" ? b.status : "on_track") as GoalStatus,
    note: text(b.note),
  });
  return NextResponse.json({ error }, { status: error ? 400 : 200 });
}
