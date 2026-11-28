import { NextResponse, type NextRequest } from "next/server";
import { getForumSettings } from "@/lib/forum-settings";

export const dynamic = "force-dynamic";

/**
 * OAuth protected-resource metadata (RFC 9728) for /api/mcp. Served at
 * /.well-known/oauth-protected-resource/api/mcp via a rewrite in next.config.ts.
 * The authorization server is Supabase Auth's OAuth 2.1 server.
 */
export async function GET(req: NextRequest) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
  const supabase = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return NextResponse.json(
    {
      resource: `${site}/api/mcp`,
      authorization_servers: [`${supabase}/auth/v1`],
      bearer_methods_supported: ["header"],
      resource_name: (await getForumSettings()).name,
    },
    { headers: { "cache-control": "public, max-age=3600", "access-control-allow-origin": "*" } }
  );
}
