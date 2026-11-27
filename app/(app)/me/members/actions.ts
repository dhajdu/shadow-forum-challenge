"use server";

import { revalidatePath } from "next/cache";
import { getForumContext } from "@/app/_data/context";
import { getMember, setMemberAccess, type AdminResult } from "@/app/_data/forum";

export type FormState = { ok: boolean; error: string | null };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function done(r: AdminResult): FormState {
  if (r.ok) {
    revalidatePath("/me/members");
    revalidatePath("/me/members/preview");
  }
  return r.ok ? { ok: true, error: null } : { ok: false, error: r.error };
}

// The database enforces admin-only (set_member_access raises 42501); this check just fails early.
async function load(form: FormData) {
  const ctx = await getForumContext();
  if (!ctx.viewer.is_admin) return { ctx, member: null };
  const member = await getMember(ctx.db, ctx.viewer, String(form.get("id") ?? ""));
  return { ctx, member };
}

/** First-forum date and the founding / admin flags. */
export async function saveAccess(_: FormState, form: FormData): Promise<FormState> {
  const { ctx, member } = await load(form);
  if (!member) return { ok: false, error: "Admins only." };
  const date = String(form.get("date") ?? "");
  const founding = form.get("founding") === "on";
  if (!founding && !DATE.test(date)) return { ok: false, error: "Pick a first-forum date." };
  if (member.id === ctx.viewer.id && form.get("admin") !== "on") return { ok: false, error: "You can't remove your own admin access." };
  return done(
    await setMemberAccess(ctx.db, ctx.viewer, member.id, {
      joined_on: DATE.test(date) ? date : null,
      left_on: member.forum_left_on,
      founding,
      admin: form.get("admin") === "on",
    })
  );
}

/** Remove from the forum (forum_left_on = today ends all access), or restore. */
export async function setLeft(_: FormState, form: FormData): Promise<FormState> {
  const { ctx, member } = await load(form);
  if (!member) return { ok: false, error: "Admins only." };
  if (member.id === ctx.viewer.id) return { ok: false, error: "You can't remove yourself." };
  const restore = form.get("restore") === "1";
  return done(
    await setMemberAccess(ctx.db, ctx.viewer, member.id, {
      joined_on: member.forum_joined_on,
      left_on: restore ? null : ctx.today,
      founding: member.is_founding,
      admin: restore ? member.is_admin : false,
    })
  );
}
