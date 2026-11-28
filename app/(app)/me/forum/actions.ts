"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getForumContext } from "@/app/_data/context";
import { FORUM_SETTINGS_TAG, type Organisation } from "@/lib/forum-settings";

export type ForumSettingsState = { ok: boolean; error: string | null };

const ORGS: Organisation[] = ["EO", "YPO", "other"];

function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function validCurrency(code: string): boolean {
  try {
    new Intl.NumberFormat("en-US", { style: "currency", currency: code });
    return /^[A-Z]{3}$/.test(code);
  } catch {
    return false;
  }
}

// Admins only: the database checks it too (RLS "forum settings admin").
export async function saveForumSettings(_: ForumSettingsState, form: FormData): Promise<ForumSettingsState> {
  const { db, viewer } = await getForumContext();
  if (!viewer.is_admin) return { ok: false, error: "Admins only." };

  const text = (k: string, max: number) => String(form.get(k) ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  const name = text("name", 80);
  const short_name = text("short_name", 40);
  const organisation = text("organisation", 10) as Organisation;
  const currency = text("currency", 3).toUpperCase();
  const dues = Number(String(form.get("dues_per_forum") ?? "").replace(/[,\s]/g, ""));
  const time_zone = text("time_zone", 64);
  const site_url = text("site_url", 200).replace(/\/+$/, "");

  if (!name || !short_name) return { ok: false, error: "The forum needs a name and a short name." };
  if (!ORGS.includes(organisation)) return { ok: false, error: "Pick EO, YPO or other." };
  if (!validCurrency(currency)) return { ok: false, error: "Currency is a three-letter code, like USD, EUR or VND." };
  if (!Number.isInteger(dues) || dues < 0) return { ok: false, error: "Dues per forum is a whole amount, 0 or more." };
  if (!validTimeZone(time_zone)) return { ok: false, error: "Pick a time zone from the list." };
  if (!/^https?:\/\/[^\s/]+$/.test(site_url)) return { ok: false, error: "Site address is like https://forum.example.com, with no path." };

  const { data, error } = await (db as unknown as SupabaseClient)
    .from("forum_settings")
    .update({ name, short_name, organisation, currency, dues_per_forum: dues, time_zone, site_url, whoop_enabled: form.get("whoop_enabled") === "on" })
    .eq("id", true)
    .select("id");
  if (error) return { ok: false, error: error.message.includes("time zone") ? "The database does not know that time zone." : "Could not save. Try again." };
  if (!data?.length) return { ok: false, error: "Not saved: only an admin can change the forum settings." };

  revalidateTag(FORUM_SETTINGS_TAG);
  revalidatePath("/", "layout");
  return { ok: true, error: null };
}
