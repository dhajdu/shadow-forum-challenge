"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getForumContext } from "@/app/_data/context";
import { consentText, getConstitution, sha256Hex } from "@/app/_data/constitution";

export type SignState = { error: string | null; ok: boolean };

// Sign the newest version. Like Edge8's agreements: the text is re-hashed and must match both the
// stored hash and the one the member was shown; their IP and browser are kept as evidence.
export async function signConstitution(_prev: SignState, form: FormData): Promise<SignState> {
  const { db, forum } = await getForumContext();
  const typed = String(form.get("typed_name") ?? "").trim().replace(/\s+/g, " ");
  if (typed.length < 2) return { error: "Type your full name to sign.", ok: false };
  if (form.get("consent") !== "on") return { error: "Tick the box to agree.", ok: false };

  const { current } = await getConstitution(db);
  if (!current) return { error: "There is no Constitution to sign yet.", ok: false };
  const shown = String(form.get("sha256") ?? "");
  if (shown !== current.sha256) return { error: "The Constitution changed while you had it open. Reload the page and read the new version.", ok: false };
  if (sha256Hex(current.body_md) !== current.sha256) return { error: "The stored Constitution does not match its fingerprint. Ask your moderator to republish it.", ok: false };

  const h = await headers();
  const { error } = await (db as unknown as SupabaseClient).from("constitution_signatures").insert({
    version_id: current.id,
    typed_name: typed.slice(0, 120),
    consent: consentText(current.version, forum.name),
    sha256_shown: shown,
    ip: (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 100) || null,
    user_agent: (h.get("user-agent") ?? "").slice(0, 500) || null,
  });
  if (error) return { error: error.code === "23505" ? "You have already signed this version." : "Could not save your signature. Try again.", ok: false };
  revalidatePath("/forum/resources/constitution");
  revalidatePath("/");
  return { error: null, ok: true };
}

export type PublishState = { error: string | null; ok: boolean; version?: number };

// Admin: publish an amendment. A new version means every member signs again.
export async function publishAmendment(_prev: PublishState, form: FormData): Promise<PublishState> {
  const { db, viewer } = await getForumContext();
  if (!viewer.is_admin) return { error: "Only an admin can publish an amendment.", ok: false };
  const body = String(form.get("body_md") ?? "").replace(/\r\n/g, "\n").trim();
  const note = String(form.get("change_note") ?? "").trim().slice(0, 2000);
  if (!body) return { error: "The Constitution can't be empty.", ok: false };
  if (!note) return { error: "Say what the amendment changes. Members read this before they sign again.", ok: false };

  const { current } = await getConstitution(db);
  if (current && current.body_md === body) return { error: "Nothing changed from the current version.", ok: false };
  const version = (current?.version ?? 0) + 1;
  const sb = db as unknown as SupabaseClient;
  const { error } = await sb.from("constitution_versions").insert({ version, body_md: body, sha256: sha256Hex(body), change_note: note });
  if (error) return { error: "Could not publish. Reload and try again.", ok: false };
  // keep the library copy (list, Ask AI, MCP) in step with the signed text
  await sb.from("library_docs").update({ body_md: `# Approved Constitution\n\n${body}`, updated_at: new Date().toISOString() }).eq("slug", "constitution");
  revalidatePath("/forum/resources/constitution");
  revalidatePath("/me/members");
  revalidatePath("/");
  return { error: null, ok: true, version };
}
