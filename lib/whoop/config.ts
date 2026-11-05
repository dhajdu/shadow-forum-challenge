// WHOOP app settings. Server-only: nothing here is safe to expose as NEXT_PUBLIC_.

export const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
export const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
export const WHOOP_API_ORIGIN = "https://api.prod.whoop.com";

/** Days the backup cron re-fetches. Webhooks cover the live edge; this fills gaps. */
export const SYNC_LOOKBACK_DAYS = 10;

/**
 * Scopes the Connect button requests. `offline` is what makes WHOOP issue a
 * refresh token; without it the link dies when the access token expires.
 */
export const WHOOP_SCOPES = [
  "read:recovery",
  "read:cycles",
  "read:sleep",
  "read:workout",
  "read:profile",
  "offline",
] as const;

export type WhoopAppCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function credentialsFromEnv(env: NodeJS.ProcessEnv = process.env): WhoopAppCredentials {
  const clientId = env.WHOOP_CLIENT_ID?.trim();
  const clientSecret = env.WHOOP_CLIENT_SECRET?.trim();
  const redirectUri = env.WHOOP_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, and WHOOP_REDIRECT_URI must be set");
  }
  return { clientId, clientSecret, redirectUri };
}

/**
 * WHOOP signs webhooks with the app client secret from the Developer Dashboard.
 * WHOOP_WEBHOOK_SECRET overrides that if the dashboard ever shows a distinct value.
 */
export function webhookSigningSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const dedicated = env.WHOOP_WEBHOOK_SECRET?.trim();
  if (dedicated) return dedicated;
  const clientSecret = env.WHOOP_CLIENT_SECRET?.trim();
  return clientSecret || null;
}

/**
 * Forum user ids whose whoop_days rows are written by an external sync
 * (Dave Hajdu's master database) and must not be overwritten by this API sync.
 * Comma-separated auth user uuids. Empty means nobody is excluded.
 */
export function externallySyncedUserIds(raw = process.env.WHOOP_EXTERNAL_SYNC_USER_IDS): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
  );
}

export function isExternallySynced(userId: string, raw = process.env.WHOOP_EXTERNAL_SYNC_USER_IDS): boolean {
  return externallySyncedUserIds(raw).has(userId);
}
