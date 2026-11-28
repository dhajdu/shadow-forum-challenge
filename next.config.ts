import type { NextConfig } from "next";

// Every page: no framing (clickjacking, e.g. of the OAuth consent page), no MIME sniffing,
// no full URLs sent to other sites, and no camera, microphone or location for embedded content.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // MCP clients discover /api/mcp's OAuth metadata at the RFC 9728 well-known path.
  async rewrites() {
    return [
      { source: "/.well-known/oauth-protected-resource/api/mcp", destination: "/api/mcp/oauth-protected-resource" },
      { source: "/.well-known/oauth-protected-resource", destination: "/api/mcp/oauth-protected-resource" },
    ];
  },
};

export default nextConfig;
