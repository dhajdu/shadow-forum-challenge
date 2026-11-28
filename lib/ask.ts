// Agenda search for Ask and MCP. Always runs on the MEMBER's Supabase client:
// match_meeting_chunks() is security invoker, so the access rule filters rows in
// Postgres before anything reaches a model. Never pass the service-role client.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { visibleAgendaMd } from "@/app/_data/recap";

type MemberClient = SupabaseClient<Database>;

export type AgendaHit = {
  meeting_id: string;
  held_on: string;
  title: string | null;
  content: string;
  rank: number;
};

/** The one reply for "nothing found". It never hints that content exists beyond the member's view. */
export const NO_RECORD = "I have no record of that in your forum agendas.";

/** The member's place in the join-date rule (their own profiles row). */
export type AgendaReader = { forum_joined_on: string | null; is_founding: boolean };

export async function readerOf(supabase: MemberClient, userId: string): Promise<AgendaReader> {
  const { data } = await supabase.from("profiles").select("forum_joined_on, is_founding").eq("id", userId).maybeSingle();
  return data ?? { forum_joined_on: null, is_founding: false };
}

const lineKey = (l: string) => l.replace(/\*\*/g, "").replace(/^\s*(--|[-*+])\s*(\[[ xX]\]\s*)?/, "").trim().toLowerCase();

/**
 * Drop excerpts that quote Parking Lot topics from before the member's first forum. Every agenda
 * repeats the running Parking Lot, so RLS on the meeting date alone is not enough. An excerpt is
 * kept only if each of its lines appears in the agenda as the member may read it.
 */
async function dropHiddenParking(supabase: MemberClient, hits: AgendaHit[], reader: AgendaReader): Promise<AgendaHit[]> {
  if (reader.is_founding || hits.length === 0) return hits;
  const ids = [...new Set(hits.map((h) => h.meeting_id))];
  const { data: docs } = await supabase.from("meeting_docs").select("meeting_id, title, body_md").in("meeting_id", ids);
  const allowed = new Map<string, Set<string>>();
  for (const d of docs ?? []) {
    const held = hits.find((h) => h.meeting_id === d.meeting_id)!.held_on;
    const set = allowed.get(d.meeting_id) ?? new Set<string>();
    if (d.title) set.add(lineKey(d.title));
    for (const l of visibleAgendaMd(d.body_md, held, reader.forum_joined_on, false).split("\n")) set.add(lineKey(l));
    allowed.set(d.meeting_id, set);
  }
  return hits.filter((h) => {
    const set = allowed.get(h.meeting_id);
    return !!set && h.content.split("\n").every((l) => !lineKey(l) || set.has(lineKey(l)));
  });
}

export async function searchAgendas(
  supabase: MemberClient,
  question: string,
  opts: { limit?: number; meetingId?: string | null; reader: AgendaReader }
): Promise<AgendaHit[]> {
  // Postgres full-text search; the member's session means RLS filters first.
  const { data, error } = await supabase.rpc("match_meeting_chunks", {
    query: question,
    match_count: opts.limit ?? 8,
    only_meeting: opts.meetingId ?? null,
  });
  if (error) throw new Error(error.message);
  const rows = await dropHiddenParking(supabase, (data ?? []).map((r) => ({ ...r, title: null })), opts.reader);
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((r) => r.meeting_id))];
  const { data: meetings } = await supabase.from("meetings").select("id, title").in("id", ids);
  const title = new Map((meetings ?? []).map((m) => [m.id, m.title]));
  return rows.map((r) => ({ ...r, title: title.get(r.meeting_id) ?? null }));
}

/** The excerpts block handed to the model, labelled by meeting so answers can cite them. */
export function excerptsFor(hits: AgendaHit[]): string {
  return hits
    .map((h) => `<excerpt meeting="${h.held_on}${h.title ? ` ${h.title}` : ""}">\n${h.content}\n</excerpt>`)
    .join("\n\n");
}

export function citations(hits: AgendaHit[]) {
  const seen = new Map<string, { id: string; held_on: string; title: string | null }>();
  for (const h of hits) if (!seen.has(h.meeting_id)) seen.set(h.meeting_id, { id: h.meeting_id, held_on: h.held_on, title: h.title });
  return [...seen.values()];
}
