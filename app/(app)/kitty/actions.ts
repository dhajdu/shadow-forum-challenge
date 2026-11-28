"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getForumContext } from "@/app/_data/context";
import { IN_CATEGORIES, OUT_CATEGORIES, parseVnd, type KittyCategory } from "@/app/_data/kitty";

export type KittyState = { error: string | null; ok: boolean };

const uuid = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  return /^[0-9a-f-]{36}$/i.test(s) ? s : null;
};

// Any active member adds a line; RLS checks membership and the date rule.
export async function addEntry(_prev: KittyState, form: FormData): Promise<KittyState> {
  const { db } = await getForumContext();
  const direction = form.get("direction") === "out" ? "out" : "in";
  const amount = parseVnd(String(form.get("amount") ?? ""));
  if (!amount) return { error: "Enter an amount, like 2.5M or 2,500,000.", ok: false };
  const allowed = direction === "in" ? IN_CATEGORIES : OUT_CATEGORIES;
  const category = allowed.includes(form.get("category") as KittyCategory) ? (form.get("category") as KittyCategory) : "other";
  const entry_on = String(form.get("entry_on") ?? "");
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
  if (direction === "out" && !note) return { error: "Say what the money went on.", ok: false };
  const { error } = await (db as unknown as SupabaseClient).from("kitty_entries").insert({
    direction,
    amount_vnd: amount,
    category,
    member_id: uuid(form.get("member_id")),
    meeting_id: uuid(form.get("meeting_id")),
    note,
    ...(/^\d{4}-\d{2}-\d{2}$/.test(entry_on) ? { entry_on } : {}),
  });
  if (error) return { error: "Could not save that line. Try again.", ok: false };
  revalidatePath("/kitty");
  revalidatePath("/");
  return { error: null, ok: true };
}

// Void instead of delete: the line stays in the ledger, struck through, with who voided it.
export async function voidEntry(form: FormData): Promise<void> {
  const { db } = await getForumContext();
  const id = uuid(form.get("id"));
  if (!id) return;
  await (db as unknown as SupabaseClient).from("kitty_entries").update({ voided_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/kitty");
  revalidatePath("/");
}

// Admin only (RLS): who holds the money.
export async function setTreasurer(form: FormData): Promise<void> {
  const { db } = await getForumContext();
  await (db as unknown as SupabaseClient).from("kitty_settings").update({ treasurer_id: uuid(form.get("treasurer_id")) }).eq("id", true);
  revalidatePath("/kitty");
  revalidatePath("/me/members");
}
