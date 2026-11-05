import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const VERSION = "v1";

/**
 * App-level AES-256-GCM for WHOOP tokens.
 *
 * Supabase Vault / pgsodium would keep the key inside Postgres, which is a
 * better fit when SQL itself must decrypt. This app only decrypts in the
 * Node server, and the migration must stay unapplied until Dave runs it, so
 * a key in the environment is the smaller moving part: the database holds
 * ciphertext even if the service role leaks, and rotating the key is an env
 * change. Generate with `openssl rand -base64 32`.
 */
export function decodeTokenKey(raw: string): Buffer {
  const buf = Buffer.from(raw.trim(), "base64");
  if (buf.length !== 32) {
    throw new Error("WHOOP_TOKEN_ENCRYPTION_KEY must decode to 32 bytes (openssl rand -base64 32)");
  }
  return buf;
}

export function tokenKeyFromEnv(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.WHOOP_TOKEN_ENCRYPTION_KEY;
  if (!raw?.trim()) throw new Error("WHOOP_TOKEN_ENCRYPTION_KEY is not set");
  return decodeTokenKey(raw);
}

export function encryptToken(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptToken(payload: string, key: Buffer): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("Unrecognized token ciphertext");
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
