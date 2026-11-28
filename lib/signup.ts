import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileCoaches } from "@/lib/coach";

export type NewRider = { code: string; name: string; email: string; password: string; ip: string | null };

// Rate limit (signup_attempts, migration 0037): per IP address, and for wrong codes from anywhere.
const WINDOW_MS = 15 * 60_000;
const PER_IP = 5;
const WRONG_CODES = 30;
export const TOO_MANY = "Too many sign-up attempts. Try again in 15 minutes.";

const sameCode = (a: string, b: string) =>
  timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/** The caller's IP address as Vercel reports it (x-real-ip, else the first x-forwarded-for). */
export function clientIp(h: Headers): string | null {
  return (h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 100) || null;
}

/**
 * Gated sign-up — checks the shared access code (server-side only) and creates the
 * account already email-confirmed. The caller signs the rider in afterwards.
 * Returns an error message, or null on success.
 */
export async function createRider({ code, name, email, password, ip }: NewRider): Promise<string | null> {
  const admin = createAdminClient();
  const from = ip ?? "unknown";
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const [mine, wrong] = await Promise.all([
    admin.from("signup_attempts").select("id", { count: "exact", head: true }).eq("ip", from).gte("at", since),
    admin.from("signup_attempts").select("id", { count: "exact", head: true }).eq("ok", false).gte("at", since),
  ]);
  if (mine.error || wrong.error) return "Sign-up is unavailable right now. Try again later.";
  if ((mine.count ?? 0) >= PER_IP || (wrong.count ?? 0) >= WRONG_CODES) return TOO_MANY;

  const expected = process.env.SIGNUP_ACCESS_CODE;
  const good = !!expected && sameCode(code.trim(), expected);
  await admin.from("signup_attempts").insert({ ip: from, ok: good });
  await admin.from("signup_attempts").delete().lt("at", new Date(Date.now() - 86_400_000).toISOString());
  if (!good) return "Invalid access code.";

  name = name.trim();
  email = email.trim();
  if (!name || !email || password.length < 6) {
    return "Enter your name, email, and a password of at least 6 characters.";
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) {
    return /already/i.test(error.message) ? "That email is already registered — sign in instead." : error.message;
  }

  // backfill coach links now that this participant exists
  await reconcileCoaches(admin);
  return null;
}
