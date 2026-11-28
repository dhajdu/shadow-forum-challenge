import { NextResponse, type NextRequest } from "next/server";
import { getRequestUser } from "@/lib/supabase/request";
import { isActiveCaller } from "@/lib/access";
import { TOOLS, callTool } from "@/lib/mcp";
import { PLANNING_GUIDE } from "@/lib/forum-planning";
import { forumSlug, readForumSettings } from "@/lib/forum-config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Remote MCP server (Streamable HTTP, stateless, JSON responses).
// Auth: each member's own OAuth access token from the Supabase OAuth 2.1 server.
// No shared key. Tools run as the member, so RLS decides what they see.

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

const PLAN_PROMPT = {
  name: "plan_forum",
  title: "Plan a forum",
  description: "Plan a forum session as the moderator: run sheet, host, presentations, gaps.",
  arguments: [{ name: "date", description: "Forum date, YYYY-MM-DD (default the next forum)", required: false }],
};

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const site = (req: NextRequest) => (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
const resourceMetadataUrl = (req: NextRequest) => `${site(req)}/.well-known/oauth-protected-resource/api/mcp`;

function unauthorized(req: NextRequest, error = "invalid_token") {
  return new NextResponse(JSON.stringify({ error }), {
    status: 401,
    headers: {
      "content-type": "application/json",
      "www-authenticate": `Bearer error="${error}", resource_metadata="${resourceMetadataUrl(req)}"`,
    },
  });
}

const reply = (id: RpcRequest["id"], result: unknown) => NextResponse.json({ jsonrpc: "2.0", id, result });
const rpcError = (id: RpcRequest["id"], code: number, message: string, status = 200) =>
  NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });

export async function POST(req: NextRequest) {
  if (!/^Bearer\s/i.test(req.headers.get("authorization") ?? "")) return unauthorized(req, "invalid_request");
  const auth = await getRequestUser(req);
  if (!auth) return unauthorized(req);
  if (!(await isActiveCaller(auth.supabase, auth.user.id))) return rpcError(null, -32001, "No forum access.", 403);

  const msg = (await req.json().catch(() => null)) as RpcRequest | null;
  if (!msg || Array.isArray(msg) || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return rpcError(null, -32600, "Invalid request", 400);
  }
  if (msg.id === undefined) return new NextResponse(null, { status: 202 }); // notification

  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      const forum = await readForumSettings(auth.supabase);
      return reply(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { name: forumSlug(forum), title: forum.name, version: "2.0.0" },
        instructions:
          `${forum.name}, as the signed-in member: forums and agendas, the Parking Lot, the library, the kitty (read it, add money in or out, submit expenses), the forum chat, goals, the contest race, WHOOP data and photos. Agendas, the Parking Lot and goals start from your own first forum; the chat, photos, the kitty and resources are open in full. Amounts are whole units of ${forum.currency}. Confirm with the member before adding to the kitty, posting to the chat or deleting. Forum planning (hosts, run sheets, presentations, planners, roles): call planning_guide first and follow it; only forum admins can change the plan, and every change needs the member's OK first.`,
      });
    }
    case "ping":
      return reply(msg.id, {});
    case "prompts/list":
      return reply(msg.id, { prompts: [PLAN_PROMPT] });
    case "prompts/get": {
      if (msg.params?.name !== PLAN_PROMPT.name) return rpcError(msg.id, -32602, `Unknown prompt: ${String(msg.params?.name ?? "")}`);
      const date = String((msg.params?.arguments as Record<string, unknown> | undefined)?.date ?? "").trim();
      const ask = date ? `Plan the forum on ${date}.` : "Plan the next forum.";
      return reply(msg.id, {
        description: PLAN_PROMPT.description,
        messages: [{ role: "user", content: { type: "text", text: `${PLANNING_GUIDE}\n\n---\n\n${ask} Start with get_forum_plan, then show the run sheet, the gaps and one question.` } }],
      });
    }
    case "tools/list":
      return reply(msg.id, { tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      if (!TOOLS.some((t) => t.name === name)) return rpcError(msg.id, -32602, `Unknown tool: ${name}`);
      try {
        const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        return reply(msg.id, await callTool(name, args, { supabase: auth.supabase, userId: auth.user.id, email: auth.user.email, token, site: site(req) }));
      } catch {
        return reply(msg.id, { content: [{ type: "text", text: "The tool failed. Try again." }], isError: true });
      }
    }
    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

// Stateless server: no SSE stream, no sessions to end.
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { allow: "POST" } });
}
export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { allow: "POST" } });
}
