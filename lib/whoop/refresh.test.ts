import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeTokenKey, decryptToken, encryptToken } from "./crypto";
import { WHOOP_USER_AGENT } from "./http";
import { WHOOP_SCOPES, WHOOP_TOKEN_URL } from "./config";
import { buildAuthorizeUrl, createOAuthState } from "./oauth";
import { ensureFreshAccess } from "./refresh";
import type { StoredConnection, TokenPatch, TokenStore } from "./refresh";

const key = decodeTokenKey(Buffer.alloc(32, 7).toString("base64"));
const creds = { clientId: "client", clientSecret: "secret", redirectUri: "https://eoshadowforum.com/api/whoop/callback" };

function memoryStore(initial: StoredConnection): TokenStore & { current: StoredConnection | null } {
  const box: { current: StoredConnection | null } = { current: { ...initial } };
  return {
    get current() {
      return box.current;
    },
    set current(value) {
      box.current = value;
    },
    async read() {
      return box.current ? { ...box.current } : null;
    },
    async write(_userId, patch: TokenPatch) {
      box.current = {
        status: patch.status,
        accessTokenEnc: patch.accessTokenEnc,
        refreshTokenEnc: patch.refreshTokenEnc,
        expiresAt: patch.expiresAt,
        scopes: patch.scopes,
      };
    },
  };
}

function tokenResponse(access: string, refresh: string, status = 200) {
  return new Response(
    JSON.stringify({
      access_token: access,
      refresh_token: refresh,
      expires_in: 3600,
      scope: "read:recovery read:cycles read:sleep read:workout read:profile offline",
      token_type: "bearer",
    }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

describe("WHOOP token refresh", () => {
  it("persists the rotated refresh token and sends a browser User-Agent", async () => {
    const store = memoryStore({
      status: "connected",
      accessTokenEnc: encryptToken("expired-access", key),
      refreshTokenEnc: encryptToken("old-refresh", key),
      expiresAt: new Date(Date.now() - 120_000).toISOString(),
      scopes: "read:recovery offline",
    });
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      const body = String(init?.body ?? "");
      const sent = new URLSearchParams(body).get("refresh_token");
      return tokenResponse("new-access", sent === "old-refresh" ? "rotated-refresh" : "rotated-again");
    };

    const first = await ensureFreshAccess({ userId: "user-a", store, creds, key, fetchImpl });
    assert.deepEqual(first, { accessToken: "new-access" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, WHOOP_TOKEN_URL);
    const headers = new Headers(calls[0].init?.headers);
    assert.equal(headers.get("user-agent"), WHOOP_USER_AGENT);
    assert.match(headers.get("user-agent") ?? "", /Mozilla/);
    assert.equal(new URLSearchParams(String(calls[0].init?.body)).get("grant_type"), "refresh_token");
    assert.equal(new URLSearchParams(String(calls[0].init?.body)).get("refresh_token"), "old-refresh");

    assert.ok(store.current);
    assert.equal(decryptToken(store.current.refreshTokenEnc!, key), "rotated-refresh");
    assert.notEqual(decryptToken(store.current.refreshTokenEnc!, key), "old-refresh");
    assert.equal(decryptToken(store.current.accessTokenEnc!, key), "new-access");
    assert.equal(store.current.status, "connected");

    const second = await ensureFreshAccess({ userId: "user-a", store, creds, key, fetchImpl });
    assert.deepEqual(second, { accessToken: "new-access" });
    assert.equal(calls.length, 1, "a still-valid access token is not refreshed again");
  });

  it("shares one refresh when two callers race", async () => {
    const store = memoryStore({
      status: "connected",
      accessTokenEnc: encryptToken("expired-access", key),
      refreshTokenEnc: encryptToken("old-refresh", key),
      expiresAt: new Date(Date.now() - 120_000).toISOString(),
      scopes: null,
    });
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return tokenResponse("shared-access", "shared-refresh");
    };
    const [a, b] = await Promise.all([
      ensureFreshAccess({ userId: "user-race", store, creds, key, fetchImpl }),
      ensureFreshAccess({ userId: "user-race", store, creds, key, fetchImpl }),
    ]);
    assert.deepEqual(a, { accessToken: "shared-access" });
    assert.deepEqual(b, { accessToken: "shared-access" });
    assert.equal(calls, 1);
    assert.equal(decryptToken(store.current!.refreshTokenEnc!, key), "shared-refresh");
  });

  it("marks the connection revoked when WHOOP rejects the refresh token", async () => {
    const store = memoryStore({
      status: "connected",
      accessTokenEnc: encryptToken("expired-access", key),
      refreshTokenEnc: encryptToken("dead-refresh", key),
      expiresAt: new Date(Date.now() - 120_000).toISOString(),
      scopes: "offline",
    });
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ error: "invalid_grant", error_description: "revoked" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });

    const result = await ensureFreshAccess({ userId: "user-revoked", store, creds, key, fetchImpl });
    assert.deepEqual(result, { disconnected: true });
    assert.equal(store.current?.status, "revoked");
    assert.equal(store.current?.accessTokenEnc, null);
    assert.equal(store.current?.refreshTokenEnc, null);
  });

  it("leaves the stored refresh token in place when WHOOP is unavailable", async () => {
    const store = memoryStore({
      status: "connected",
      accessTokenEnc: encryptToken("expired-access", key),
      refreshTokenEnc: encryptToken("keep-me", key),
      expiresAt: new Date(Date.now() - 120_000).toISOString(),
      scopes: null,
    });
    const fetchImpl: typeof fetch = async () => new Response("upstream", { status: 503 });
    await assert.rejects(() => ensureFreshAccess({ userId: "user-down", store, creds, key, fetchImpl }));
    assert.equal(store.current?.status, "connected");
    assert.equal(decryptToken(store.current!.refreshTokenEnc!, key), "keep-me");
  });

  it("asks WHOOP for the read scopes and offline, with an 8-character state", () => {
    const state = createOAuthState();
    assert.equal(state.length, 8);
    const url = new URL(buildAuthorizeUrl(creds, state));
    assert.equal(`${url.origin}${url.pathname}`, "https://api.prod.whoop.com/oauth/oauth2/auth");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("scope"), WHOOP_SCOPES.join(" "));
    assert.equal(url.searchParams.get("state"), state);
    assert.equal(url.searchParams.get("redirect_uri"), creds.redirectUri);
  });

  it("does not store plaintext tokens", () => {
    const enc = encryptToken("refresh-secret", key);
    assert.equal(enc.includes("refresh-secret"), false);
    assert.equal(decryptToken(enc, key), "refresh-secret");
  });
});
