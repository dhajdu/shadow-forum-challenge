import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // MCP clients discover /api/mcp's OAuth metadata at the RFC 9728 well-known path.
  async rewrites() {
    return [
      { source: "/.well-known/oauth-protected-resource/api/mcp", destination: "/api/mcp/oauth-protected-resource" },
      { source: "/.well-known/oauth-protected-resource", destination: "/api/mcp/oauth-protected-resource" },
    ];
  },
};

export default nextConfig;
