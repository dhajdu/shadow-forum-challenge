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
export const consentText = (version: number) =>
  `I have read the Constitution of The Shadow Forum (version ${version}) and I agree to it. I understand that typing my name is my signature.`;

export async function getConstitution(db: Db): Promise<{ current: ConstitutionVersion | null; versions: ConstitutionVersion[]; signatures: Signature[] }> {
  const sb = db as unknown as SupabaseClient;
  const [{ data: v }, { data: s }] = await Promise.all([
    sb.from("constitution_versions").select("id, version, body_md, sha256, change_note, published_at").order("version", { ascending: false }),
    sb.from("constitution_signatures").select("version_id, user_id, typed_name, signed_at").order("signed_at"),
  ]);
  const versions = (v ?? []) as ConstitutionVersion[];
  return { current: versions[0] ?? null, versions, signatures: (s ?? []) as Signature[] };
}
