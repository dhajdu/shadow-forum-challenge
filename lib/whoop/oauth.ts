import { randomBytes } from "crypto";
import { WHOOP_AUTH_URL, WHOOP_SCOPES, WHOOP_TOKEN_URL, type WhoopAppCredentials } from "@/lib/whoop/config";
import { whoopRequest } from "@/lib/whoop/http";

export const OAUTH_STATE_COOKIE = "whoop_oauth_state";

/**
 * WHOOP requires the OAuth `state` to be eight characters when the app
 * generates it. The cookie binds that value to the signed-in user so the
 * callback can reject a forged or swapped redirect.
 */
const STATE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function createOAuthState(): string {
  const bytes = randomBytes(8);
  let state = "";
  for (let i = 0; i < 8; i++) state += STATE_ALPHABET[bytes[i] % STATE_ALPHABET.length];
  return state;
}

export function packOAuthState(state: string, userId: string): string {
  return `${state}.${userId}`;
}

export function unpackOAuthState(cookie: string | undefined | null): { state: string; userId: string } | null {
  if (!cookie) return null;
  const dot = cookie.indexOf(".");
  if (dot !== 8) return null;
  const state = cookie.slice(0, 8);
  const userId = cookie.slice(9);
  if (!/^[A-Za-z0-9]{8}$/.test(state) || userId.length === 0) return null;
  return { state, userId };
}

export function buildAuthorizeUrl(creds: WhoopAppCredentials, state: string): string {
  if (!/^[A-Za-z0-9]{8}$/.test(state)) throw new Error("WHOOP state must be 8 alphanumeric characters");
  const url = new URL(WHOOP_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", creds.redirectUri);
  url.searchParams.set("scope", WHOOP_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export type WhoopTokenSet = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

export class WhoopTokenError extends Error {
  readonly status: number;
  readonly oauthError: string | null;

  constructor(message: string, status: number, oauthError: string | null) {
    super(message);
    this.name = "WhoopTokenError";
    this.status = status;
    this.oauthError = oauthError;
  }
}

/** Refresh-endpoint 400/401 means the grant is dead. Other failures are transient. */
export function tokenErrorDisconnects(err: unknown): boolean {
  return err instanceof WhoopTokenError && (err.status === 400 || err.status === 401);
}

export type StoredTokenFields = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scopes: string | null;
};

/**
 * What to persist after WHOOP returns a token response. The refresh token in
 * the response replaces the one we sent — the previous refresh token is dead.
 */
export function persistedTokens(tokens: WhoopTokenSet, now = Date.now()): StoredTokenFields {
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new WhoopTokenError("WHOOP token response did not include an access and refresh token", 502, "invalid_response");
  }
  if (!Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0) {
    throw new WhoopTokenError("WHOOP token response did not include expires_in", 502, "invalid_response");
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(now + tokens.expires_in * 1000).toISOString(),
    scopes: tokens.scope ?? null,
  };
}

async function requestToken(
  body: URLSearchParams,
  fetchImpl: typeof fetch
): Promise<WhoopTokenSet> {
  const res = await whoopRequest(
    WHOOP_TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    fetchImpl
  );
  const text = await res.text();
  type TokenJson = Partial<WhoopTokenSet> & { error?: string; error_description?: string };
  let json: TokenJson | null = null;
  try {
    json = text ? (JSON.parse(text) as TokenJson) : null;
  } catch {
    json = null;
  }
  if (!res.ok || !json?.access_token) {
    throw new WhoopTokenError(
      json?.error_description || json?.error || `WHOOP token endpoint returned ${res.status}`,
      res.status,
      json?.error ?? null
    );
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? "",
    expires_in: Number(json.expires_in),
    scope: json.scope,
    token_type: json.token_type,
  };
}

export function exchangeAuthorizationCode(
  code: string,
  creds: WhoopAppCredentials,
  fetchImpl: typeof fetch = fetch
): Promise<WhoopTokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: creds.redirectUri,
  });
  return requestToken(body, fetchImpl);
}

export function refreshAccessToken(
  refreshToken: string,
  creds: WhoopAppCredentials,
  fetchImpl: typeof fetch = fetch,
  scope?: string | null
): Promise<WhoopTokenSet> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });
  // Send the scopes we already hold. Sending only `offline` can narrow the grant.
  if (scope) body.set("scope", scope);
  return requestToken(body, fetchImpl);
}

/** Best-effort revoke. 401/404 means WHOOP already dropped the grant. */
export async function revokeWhoopAccess(accessToken: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  await whoopRequest(
    "https://api.prod.whoop.com/developer/v2/user/access",
    { method: "DELETE", accessToken },
    fetchImpl
  );
}
