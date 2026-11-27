// Build the agenda search index: meeting_docs → meeting_chunks (service role).
// Each chunk carries its meeting's held_on (set by a trigger), so the access rule
// filters search results without a join.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { embed, toVector } from "@/lib/embed";

type Admin = SupabaseClient<Database>;
const TARGET = 1200; // characters per chunk

/** Split markdown on blank lines, packing paragraphs up to ~TARGET characters. */
export function chunkText(md: string): string[] {
  const paras = md.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    for (let i = 0; i < p.length; i += TARGET * 2) {
      const piece = p.slice(i, i + TARGET * 2); // a single huge paragraph is cut hard
      if (cur && cur.length + piece.length + 2 > TARGET) {
        out.push(cur);
        cur = "";
      }
      cur = cur ? `${cur}\n\n${piece}` : piece;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Replace one meeting's chunks from its docs. Returns the number of chunks written. */
export async function reindexMeeting(admin: Admin, meetingId: string): Promise<number> {
  const { data: docs, error } = await admin.from("meeting_docs").select("title, body_md").eq("meeting_id", meetingId);
  if (error) throw new Error(error.message);
  const texts = (docs ?? []).flatMap((d) => chunkText(d.body_md).map((c) => (d.title ? `${d.title}\n\n${c}` : c)));
  const vectors = await embed(texts, "document");

  const del = await admin.from("meeting_chunks").delete().eq("meeting_id", meetingId);
  if (del.error) throw new Error(del.error.message);
  if (texts.length === 0) return 0;
  const ins = await admin
    .from("meeting_chunks")
    .insert(texts.map((content, i) => ({ meeting_id: meetingId, content, embedding: toVector(vectors[i]) })));
  if (ins.error) throw new Error(ins.error.message);
  return texts.length;
}

/** Reindex meetings whose docs are newer than their chunks (or have none). */
export async function reindexStale(admin: Admin): Promise<{ meetings: number; chunks: number }> {
  const [{ data: docs, error: e1 }, { data: chunks, error: e2 }] = await Promise.all([
    admin.from("meeting_docs").select("meeting_id, created_at, source_updated_at"),
    admin.from("meeting_chunks").select("meeting_id, created_at"),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);

  const indexedAt = new Map<string, string>();
  for (const c of chunks ?? []) {
    const cur = indexedAt.get(c.meeting_id);
    if (!cur || c.created_at < cur) indexedAt.set(c.meeting_id, c.created_at);
  }
  const stale = new Set<string>();
  for (const d of docs ?? []) {
    const at = indexedAt.get(d.meeting_id);
    const changed = d.source_updated_at && d.source_updated_at > d.created_at ? d.source_updated_at : d.created_at;
    if (!at || changed > at) stale.add(d.meeting_id);
  }
  let total = 0;
  for (const id of stale) total += await reindexMeeting(admin, id);
  return { meetings: stale.size, chunks: total };
}
