"use server";

import { revalidatePath } from "next/cache";
import { getForumContext } from "@/app/_data/context";
import { listSeasons } from "@/app/_data/forum";
import { seasonForDay } from "@/lib/contest";
import { checkinGain } from "@/lib/goal-points";
import { getContestBoard } from "@/lib/goal-standings";

export type CheckinState = { ok: boolean; error: string | null; gain: string | null };

const fmtGain = (g: ReturnType<typeof checkinGain>) =>
  [
    g.checkin && `+${g.checkin} pts check-in`,
    g.progress && `${g.progress > 0 ? "+" : ""}${g.progress} pts progress`,
    g.streak && `+${g.streak} pts streak`,
    g.goal && `+${g.goal} pts goal hit`,
  ]
    .filter(Boolean)
    .join(" · ") || "No new points: this period is already scored the same";

// One check-in a day on the member's own contest goal, for today's season.
// RLS (goal_checkins, 0034) checks it is their goal, today, inside the season.
export async function saveCheckin(_: CheckinState, form: FormData): Promise<CheckinState> {
  const { db, user, viewer, forum, today } = await getForumContext();
  const raw = String(form.get("value") ?? "").trim().replace(/,/g, "");
  const value = Number(raw);
  if (!raw || !Number.isFinite(value)) return { ok: false, error: "Enter this period's number for your goal.", gain: null };
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;

  const season = seasonForDay(await listSeasons(db, viewer), today);
  if (!season || today > season.ends_on) return { ok: false, error: "No contest season is running.", gain: null };
  const board = await getContestBoard(db, season, { whoopEnabled: forum.whoopEnabled, today });
  if (!board.tracks.goals) return { ok: false, error: "This season is not scored on goal check-ins.", gain: null };
  const goal = board.rows.find((r) => r.user_id === user.id)?.goal;
  if (!goal) return { ok: false, error: "Set your contest goal first.", gain: null };

  const gain = checkinGain(goal.input, value);
  const { data: existing } = await db
    .from("goal_checkins")
    .select("id")
    .eq("goal_id", goal.goalId)
    .eq("checked_on", today)
    .maybeSingle();
  const { error } = existing
    ? await db.from("goal_checkins").update({ value, note }).eq("id", existing.id)
    : await db.from("goal_checkins").insert({ goal_id: goal.goalId, user_id: user.id, value, note });
  if (error) return { ok: false, error: error.message, gain: null };

  revalidatePath("/contest");
  revalidatePath("/");
  return { ok: true, error: null, gain: fmtGain(gain) };
}
