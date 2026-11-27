// Agenda search for Ask and MCP. Always runs on the MEMBER's Supabase client:
// match_meeting_chunks() is security invoker, so the access rule filters rows in
// Postgres before anything reaches a model. Never pass the service-role client.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

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

export async function searchAgendas(
  supabase: MemberClient,
  question: string,
  opts: { limit?: number; meetingId?: string | null } = {}
): Promise<AgendaHit[]> {
  // Postgres full-text search; the member's session means RLS filters first.
  const { data, error } = await supabase.rpc("match_meeting_chunks", {
    query: question,
    match_count: opts.limit ?? 8,
    only_meeting: opts.meetingId ?? null,
  });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
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
