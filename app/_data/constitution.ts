// The Constitution and its e-signatures: versions pinned by sha256, one signature per member per version.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Db } from "./types";

export type ConstitutionVersion = {
  id: string;
  version: number;
  body_md: string;
  sha256: string;
  change_note: string | null;
  published_at: string;
};
export type Signature = { version_id: string; user_id: string; typed_name: string; signed_at: string };

export const sha256Hex = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** The exact words a member agrees to. Stored with the signature. */
export const consentText = (version: number, forumName: string) =>
  `I have read the Constitution of ${forumName} (version ${version}) and I agree to it. I understand that typing my name is my signature.`;

/** Where a member who hasn't signed the newest Constitution is held until they do. */
export const SIGN_PATH = "/forum/resources/constitution";

/** True when there is a Constitution this member can sign and they haven't signed its newest version. */
export async function mustSignConstitution(db: Db, userId: string): Promise<boolean> {
  const sb = db as unknown as SupabaseClient;
  const { data: v } = await sb.from("constitution_versions").select("id").order("version", { ascending: false }).limit(1).maybeSingle();
  if (!v) return false; // none published, or not an active member (RLS)
  const { count } = await sb.from("constitution_signatures").select("id", { count: "exact", head: true }).eq("version_id", v.id).eq("user_id", userId);
  return (count ?? 0) === 0;
}

export async function getConstitution(db: Db): Promise<{ current: ConstitutionVersion | null; versions: ConstitutionVersion[]; signatures: Signature[] }> {
  const sb = db as unknown as SupabaseClient;
  const [{ data: v }, { data: s }] = await Promise.all([
    sb.from("constitution_versions").select("id, version, body_md, sha256, change_note, published_at").order("version", { ascending: false }),
    sb.from("constitution_signatures").select("version_id, user_id, typed_name, signed_at").order("signed_at"),
  ]);
  const versions = (v ?? []) as ConstitutionVersion[];
  return { current: versions[0] ?? null, versions, signatures: (s ?? []) as Signature[] };
}
