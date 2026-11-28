"use server";

import { revalidatePath } from "next/cache";
import { getForumContext } from "@/app/_data/context";
import { createSeason } from "@/app/_data/forum";
import { parseMoney } from "@/app/_data/kitty";
import { CHECKIN_RHYTHMS } from "@/lib/goal-points";

export type SeasonFormState = { ok: boolean; error: string | null };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SCORING = ["goals", "whoop", "both"] as const;
type Scoring = (typeof SCORING)[number];
const scoringOf = (v: FormDataEntryValue | null): Scoring | null => (SCORING as readonly string[]).includes(String(v)) ? (String(v) as Scoring) : null;

export async function addSeason(_: SeasonFormState, form: FormData): Promise<SeasonFormState> {
  const { db, viewer } = await getForumContext();
  if (!viewer.is_admin) return { ok: false, error: "Admins only." };
  const name = String(form.get("name") ?? "").trim();
  const starts_on = String(form.get("starts_on") ?? "");
  const ends_on = String(form.get("ends_on") ?? "");
  const metric = String(form.get("metric") ?? "");
  const contest_name = String(form.get("contest_name") ?? "").trim().slice(0, 60) || null;
  if (!name || !DATE.test(starts_on) || !DATE.test(ends_on)) return { ok: false, error: "Name, start and end are required." };
  if (ends_on <= starts_on) return { ok: false, error: "The end must be after the start." };
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const r = await createSeason(db, viewer, { name, slug, starts_on, ends_on, metric: metric || null, scoring: scoringOf(form.get("scoring")), contest_name });
  if (r.ok) revalidatePath("/me/seasons");
  return r.ok ? { ok: true, error: null } : { ok: false, error: r.error };
}

/** A whole amount of the forum's currency, "0" allowed; blank is null. Undefined: not a valid amount. */
function amountOf(v: FormDataEntryValue | null, currency: string, allowZero = false): number | null | undefined {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (allowZero && /^0+$/.test(s)) return 0;
  return parseMoney(s, currency) ?? undefined;
}

function points(v: FormDataEntryValue | null, max: number): number | undefined {
  const n = Number(String(v ?? "").trim());
  return Number.isInteger(n) && n >= 0 && n <= max ? n : undefined;
}

// Season rules (seasons columns from 0034), under the "seasons admin update" policy.
export async function updateSeasonRules(_: SeasonFormState, form: FormData): Promise<SeasonFormState> {
  const { db, viewer, forum } = await getForumContext();
  if (!viewer.is_admin) return { ok: false, error: "Admins only." };
  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false, error: "Which season?" };

  const raw = String(form.get("scoring") ?? "");
  const scoring = raw === "none" ? null : scoringOf(raw);
  if (raw !== "none" && !scoring) return { ok: false, error: "Pick how the contest is scored." };
  const checkin_days = Number(form.get("checkin_days"));
  if (!CHECKIN_RHYTHMS.some((r) => r.days === checkin_days)) return { ok: false, error: "Pick a check-in rhythm." };
  const p = {
    points_checkin: points(form.get("points_checkin"), 1000),
    points_progress: points(form.get("points_progress"), 1000),
    points_streak: points(form.get("points_streak"), 1000),
    points_goal: points(form.get("points_goal"), 10000),
  };
  if (Object.values(p).some((x) => x === undefined)) return { ok: false, error: "Points must be whole numbers from 0." };

  const fines = {
    missed_checkin_fine: amountOf(form.get("missed_checkin_fine"), forum.currency),
    missed_goal_fine: amountOf(form.get("missed_goal_fine"), forum.currency),
    coach_share_fine: amountOf(form.get("coach_share_fine"), forum.currency),
  };
  if (Object.values(fines).some((x) => x === undefined)) return { ok: false, error: `Fines are amounts in ${forum.currency}, or blank for none.` };

  const ladderText = String(form.get("ladder") ?? "").trim();
  const ladder = ladderText ? ladderText.split(/[;\n]|,\s+/).map((x) => amountOf(x, forum.currency, true)) : [];
  if (ladder.some((x) => x == null)) return { ok: false, error: `Placement stakes are amounts in ${forum.currency} from 1st place, separated by commas.` };

  const { error } = await db
    .from("seasons")
    .update({
      contest_name: String(form.get("contest_name") ?? "").trim().slice(0, 60) || null,
      scoring,
      checkin_days,
      ...(p as Record<keyof typeof p, number>),
      ...(fines as Record<keyof typeof fines, number | null>),
      ladder: ladder.length ? (ladder as number[]) : null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me/seasons");
  revalidatePath("/contest", "layout");
  revalidatePath("/");
  return { ok: true, error: null };
}
