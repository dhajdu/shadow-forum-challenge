"use server";

import { revalidatePath } from "next/cache";
import { getForumContext } from "@/app/_data/context";
import { createSeason } from "@/app/_data/forum";

export type SeasonFormState = { ok: boolean; error: string | null };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function addSeason(_: SeasonFormState, form: FormData): Promise<SeasonFormState> {
  const { db, viewer } = await getForumContext();
  if (!viewer.is_admin) return { ok: false, error: "Admins only." };
  const name = String(form.get("name") ?? "").trim();
  const starts_on = String(form.get("starts_on") ?? "");
  const ends_on = String(form.get("ends_on") ?? "");
  const metric = String(form.get("metric") ?? "");
  if (!name || !DATE.test(starts_on) || !DATE.test(ends_on)) return { ok: false, error: "Name, start and end are required." };
  if (ends_on <= starts_on) return { ok: false, error: "The end must be after the start." };
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const r = await createSeason(db, viewer, { name, slug, starts_on, ends_on, metric });
  if (r.ok) revalidatePath("/me/seasons");
  return r.ok ? { ok: true, error: null } : { ok: false, error: r.error };
}
