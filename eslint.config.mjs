import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Ask and MCP answer a member, so they run on that member's session only.
    files: ["app/api/ask/**", "app/api/mcp/**", "lib/ask.ts", "lib/mcp.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "@/lib/supabase/admin", message: "Ask and MCP must use the member's own session, never the service-role key." }] },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "MemberExpression[property.name='SUPABASE_SERVICE_ROLE_KEY']", message: "No service-role key in Ask or MCP." },
      ],
    },
  },
];

export default eslintConfig;
