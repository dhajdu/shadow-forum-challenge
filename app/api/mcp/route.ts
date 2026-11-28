import { NextResponse, type NextRequest } from "next/server";
import { getRequestUser } from "@/lib/supabase/request";
import { isActiveCaller } from "@/lib/access";
import { TOOLS, callTool } from "@/lib/mcp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Remote MCP server (Streamable HTTP, stateless, JSON responses).
// Auth: each member's own OAuth access token from the Supabase OAuth 2.1 server.
// No shared key. Tools run as the member, so RLS decides what they see.

const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];
const SERVER_INFO = { name: "shadow-forum", title: "The Shadow Forum", version: "2.0.0" };

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
      return reply(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "The Shadow Forum, as the signed-in member: forums and agendas, the Parking Lot, the library, the kitty (read it, add money in or out, submit expenses), the forum chat, goals, the contest race, WHOOP data and photos. Agendas, the Parking Lot and goals start from your own first forum; the chat, photos, the kitty and resources are open in full. Amounts are in VND. Confirm with the member before adding to the kitty, posting to the chat or deleting.",
      });
    }
    case "ping":
      return reply(msg.id, {});
    case "tools/list":
      return reply(msg.id, { tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      if (!TOOLS.some((t) => t.name === name)) return rpcError(msg.id, -32602, `Unknown tool: ${name}`);
      try {
        const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        return reply(msg.id, await callTool(name, args, { supabase: auth.supabase, userId: auth.user.id, token, site: site(req) }));
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
