// Build the agenda search index: meeting_doc_sources → meeting_chunks (service role).
// Each chunk carries its meeting's held_on (set by a trigger), so the access rule
// filters search results without a join. Postgres keeps the full-text column
// (meeting_chunks.search) up to date itself.
//
// Every agenda repeats the running Parking Lot, so each Parking Lot topic group
// becomes its own chunks, dated with the group's date (visible_from), and RLS
// checks that date too (migration 0035). agenda_parts() in Postgres does the
// split, the same one the meeting_docs view uses. The database refuses a
// Parking Lot chunk without visible_from.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

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

const PARKING_HEADING = /^##\s+parking lot/i;

/** Replace one meeting's chunks from its docs. Returns the number of chunks written. */
export async function reindexMeeting(admin: Admin, meetingId: string): Promise<number> {
  const [{ data: docs, error }, { data: meeting, error: e2 }] = await Promise.all([
    admin.from("meeting_doc_sources").select("title, body_md").eq("meeting_id", meetingId),
    admin.from("meetings").select("held_on").eq("id", meetingId).single(),
  ]);
  if (error || e2) throw new Error((error ?? e2)!.message);
  const rows: { meeting_id: string; content: string; visible_from: string | null }[] = [];
  for (const d of docs ?? []) {
    const { data: parts, error: e3 } = await admin.rpc("agenda_parts", { md: d.body_md, held_on: meeting.held_on });
    if (e3) throw new Error(e3.message);
    for (const p of parts ?? []) {
      const parking = p.visible_from != null;
      // the heading goes on every Parking Lot chunk, never on the others
      const text = parking ? p.body : p.body.split("\n").filter((l) => !PARKING_HEADING.test(l)).join("\n");
      const head = [d.title, parking ? "## Parking Lot" : ""].filter(Boolean).join("\n\n");
      for (const c of chunkText(text)) rows.push({ meeting_id: meetingId, content: head ? `${head}\n\n${c}` : c, visible_from: p.visible_from });
    }
  }
  const del = await admin.from("meeting_chunks").delete().eq("meeting_id", meetingId);
  if (del.error) throw new Error(del.error.message);
  if (rows.length === 0) return 0;
  const ins = await admin.from("meeting_chunks").insert(rows);
  if (ins.error) throw new Error(ins.error.message);
  return rows.length;
}

/** Reindex meetings whose docs are newer than their chunks (or have none). */
export async function reindexStale(admin: Admin): Promise<{ meetings: number; chunks: number }> {
  const [{ data: docs, error: e1 }, { data: chunks, error: e2 }] = await Promise.all([
    admin.from("meeting_doc_sources").select("meeting_id, created_at, source_updated_at"),
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
