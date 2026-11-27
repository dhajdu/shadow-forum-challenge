// MCP tools for The Shadow Forum. Read-only, and every tool runs on the calling
// member's own Supabase client (their OAuth access token), so RLS applies.
// Never import the service-role client here; eslint enforces it.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { NO_RECORD, searchAgendas } from "@/lib/ask";

type MemberClient = SupabaseClient<Database>;
type Ctx = { supabase: MemberClient; userId: string };
type ToolResult = { content: { type: "text"; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const json = (v: Record<string, unknown>): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(v, null, 2) }], structuredContent: v });
const fail = (text: string): ToolResult => ({ content: [{ type: "text", text }], isError: true });

export const TOOLS = [
  {
    name: "list_meetings",
    title: "List forum meetings",
    description: "Forum meetings you can see, past and planned, newest first. Optional date range (YYYY-MM-DD).",
    inputSchema: {
      type: "object",
      properties: { from: { type: "string", description: "Earliest date, YYYY-MM-DD" }, to: { type: "string", description: "Latest date, YYYY-MM-DD" } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_agenda",
    title: "Get an agenda",
    description: "The agenda text of one meeting, by meeting_id from list_meetings or search_agendas.",
    inputSchema: { type: "object", properties: { meeting_id: { type: "string" } }, required: ["meeting_id"], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "search_agendas",
    title: "Search agendas",
    description: "Search the agendas of meetings you can see. Returns matching excerpts with their meeting id and date.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 10 } },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "my_contest",
    title: "My contest",
    description: "Your goal, your race position and your kitty entries in the contest seasons you can see.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
] as const;

export async function callTool(name: string, args: Record<string, unknown>, ctx: Ctx): Promise<ToolResult> {
  const { supabase } = ctx;
  switch (name) {
    case "list_meetings": {
      let q = supabase.from("meetings").select("id, held_on, title, kind, status, place").order("held_on", { ascending: false }).limit(100);
      if (typeof args.from === "string" && DAY.test(args.from)) q = q.gte("held_on", args.from);
      if (typeof args.to === "string" && DAY.test(args.to)) q = q.lte("held_on", args.to);
      const { data, error } = await q;
      if (error) return fail("Could not list meetings.");
      return json({ meetings: data ?? [] });
    }
    case "get_agenda": {
      const id = typeof args.meeting_id === "string" ? args.meeting_id : "";
      if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("No agenda found.");
      const [{ data: meeting }, { data: docs }] = await Promise.all([
        supabase.from("meetings").select("id, held_on, title, kind, status, place").eq("id", id).maybeSingle(),
        supabase.from("meeting_docs").select("title, body_md").eq("meeting_id", id),
      ]);
      // Same answer for "not there" and "not yours", so nothing is confirmed.
      if (!meeting) return fail("No agenda found.");
      return json({ meeting, docs: docs ?? [] });
    }
    case "search_agendas": {
      const query = typeof args.query === "string" ? args.query.trim().slice(0, 500) : "";
      if (!query) return fail("Give a query.");
      const limit = Math.min(10, Math.max(1, Number(args.limit) || 5));
      const hits = await searchAgendas(supabase, query, { limit });
      if (hits.length === 0) return json({ results: [], note: NO_RECORD });
      return json({
        results: hits.map((h) => ({ meeting_id: h.meeting_id, held_on: h.held_on, title: h.title, excerpt: h.content, rank: Math.round(h.rank * 1000) / 1000 })),
      });
    }
    case "my_contest": {
      const [{ data: seasons }, { data: goal }, { data: race }, { data: penalties }] = await Promise.all([
        supabase.from("seasons").select("id, slug, name, starts_on, ends_on").order("starts_on"),
        supabase.from("goals").select("title, unit, target_value, current_value, current_progress, current_status, season_id").eq("user_id", ctx.userId),
        supabase.from("race_standings").select("user_id, full_name, contest_avg, contest_days, contest_missed"),
        supabase.from("penalties").select("kind, amount_m, reason, period, season_id").eq("user_id", ctx.userId),
      ]);
      const board = (race ?? []).sort((a, b) => b.contest_avg - a.contest_avg);
      const rank = board.findIndex((r) => r.user_id === ctx.userId);
      return json({
        seasons: seasons ?? [],
        goals: goal ?? [],
        race: rank >= 0 ? { rank: rank + 1, riders: board.length, avg: board[rank].contest_avg, days: board[rank].contest_days, missed: board[rank].contest_missed } : null,
        penalties: penalties ?? [],
      });
    }
    default:
      return fail(`Unknown tool: ${name}`);
  }
}
