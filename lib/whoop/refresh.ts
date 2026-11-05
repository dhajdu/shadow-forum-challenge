import type { WhoopAppCredentials } from "@/lib/whoop/config";
import { decryptToken, encryptToken } from "@/lib/whoop/crypto";
import {
  persistedTokens,
  refreshAccessToken,
  tokenErrorDisconnects,
  type WhoopTokenSet,
} from "@/lib/whoop/oauth";

export type StoredConnection = {
  status: "connected" | "disconnected" | "revoked";
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  expiresAt: string | null;
  scopes: string | null;
};

export type TokenPatch = {
  status: "connected" | "revoked";
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  expiresAt: string | null;
  scopes: string | null;
  lastError: string | null;
};

export type TokenStore = {
  read(userId: string): Promise<StoredConnection | null>;
  write(userId: string, patch: TokenPatch): Promise<void>;
};

export type FreshAccess = { accessToken: string } | { disconnected: true };

const REVOKED_ERROR = "WHOOP access was revoked or the refresh token is no longer valid. Connect again.";

const tails = new Map<string, Promise<void>>();

async function withLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(userId) ?? Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = prev.then(() => gate);
  tails.set(userId, tail);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (tails.get(userId) === tail) tails.delete(userId);
  }
}

function accessStillValid(expiresAt: string | null, now: number): boolean {
  if (!expiresAt) return false;
  const exp = Date.parse(expiresAt);
  return Number.isFinite(exp) && exp - 60_000 > now;
}

async function readAndMaybeRefresh(
  args: {
    userId: string;
    store: TokenStore;
    creds: WhoopAppCredentials;
    key: Buffer;
    fetchImpl?: typeof fetch;
    now?: number;
  },
  force: boolean
): Promise<FreshAccess> {
  const now = args.now ?? Date.now();
  const row = await args.store.read(args.userId);
  if (!row || row.status !== "connected" || !row.refreshTokenEnc) return { disconnected: true };

  if (!force && row.accessTokenEnc && accessStillValid(row.expiresAt, now)) {
    return { accessToken: decryptToken(row.accessTokenEnc, args.key) };
  }

  const refreshToken = decryptToken(row.refreshTokenEnc, args.key);
  try {
    const tokens: WhoopTokenSet = await refreshAccessToken(refreshToken, args.creds, args.fetchImpl, row.scopes);
    const stored = persistedTokens(tokens, now);
    await args.store.write(args.userId, {
      status: "connected",
      accessTokenEnc: encryptToken(stored.accessToken, args.key),
      refreshTokenEnc: encryptToken(stored.refreshToken, args.key),
      expiresAt: stored.expiresAt,
      scopes: stored.scopes ?? row.scopes,
      lastError: null,
    });
    return { accessToken: stored.accessToken };
  } catch (err) {
    if (!tokenErrorDisconnects(err)) throw err;
    const again = await args.store.read(args.userId);
    if (
      again?.refreshTokenEnc &&
      again.refreshTokenEnc !== row.refreshTokenEnc &&
      again.accessTokenEnc &&
      accessStillValid(again.expiresAt, now)
    ) {
      return { accessToken: decryptToken(again.accessTokenEnc, args.key) };
    }
    await args.store.write(args.userId, {
      status: "revoked",
      accessTokenEnc: null,
      refreshTokenEnc: null,
      expiresAt: null,
      scopes: row.scopes,
      lastError: REVOKED_ERROR,
    });
    return { disconnected: true };
  }
}

/** Return a usable access token, refreshing and persisting the rotated refresh token when needed. */
export function ensureFreshAccess(args: {
  userId: string;
  store: TokenStore;
  creds: WhoopAppCredentials;
  key: Buffer;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<FreshAccess> {
  return withLock(args.userId, () => readAndMaybeRefresh(args, false));
}

/** Refresh even if the stored access token has not reached its expiry (used after a 401). */
export function forceRefreshAccess(args: {
  userId: string;
  store: TokenStore;
  creds: WhoopAppCredentials;
  key: Buffer;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<FreshAccess> {
  return withLock(args.userId, () => readAndMaybeRefresh(args, true));
}
