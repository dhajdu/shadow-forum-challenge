// The website's API, called with the member's own access token (never a stronger key).
// Every call carries `Authorization: Bearer <token>` and `x-app-build: <build>`; a 426 means this
// build is older than MOBILE_MIN_BUILD and flips the app to "Update the app".
import { fetch as streamingFetch } from "expo/fetch";
import { config } from "./config";
import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

// ── update-required signal (read by UpdateGate) ──
let updateRequired = false;
const listeners = new Set<() => void>();
export const updateSignal = {
  get: () => updateRequired,
  set() {
    updateRequired = true;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};

export const BUILD_HEADER = "x-app-build";

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession(); // refreshes if needed
  const t = data.session?.access_token;
  if (!t) throw new ApiError("Not signed in.", 401);
  return t;
}

async function headers(auth: boolean): Promise<Record<string, string>> {
  const h: Record<string, string> = { "Content-Type": "application/json", [BUILD_HEADER]: String(config.buildNumber) };
  if (auth) h.Authorization = `Bearer ${await token()}`;
  return h;
}

async function errorOf(res: { status: number; text(): Promise<string> }): Promise<ApiError> {
  if (res.status === 426) updateSignal.set();
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as { error?: string };
    if (j.error === "update_required") return new ApiError("Update the app to continue.", 426);
    if (j.error) return new ApiError(j.error, res.status);
  } catch {}
  if (res.status === 401) return new ApiError("Your session expired. Sign in again.", 401);
  if (res.status === 403) return new ApiError("Your account has no forum access.", 403);
  return new ApiError(`Server error (${res.status}).`, res.status);
}

export async function api<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  auth = true,
): Promise<T> {
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: await headers(auth),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw await errorOf(res);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/** Public: the oldest build the server accepts. */
export async function minBuild(): Promise<number | null> {
  const res = await fetch(`${config.apiBaseUrl}/api/mobile/config`);
  if (!res.ok) return null;
  const j = (await res.json()) as { min_build?: number | null };
  return j.min_build ?? null;
}

// ── Ask ──

export type Cited = { id: string; held_on: string; title: string | null };

/**
 * POST /api/ask { question, meetingId? } — streams plain text; citations arrive in the
 * x-cited-meetings header. Runs on the member's session, so it only sees what they may see.
 */
export async function ask(
  question: string,
  meetingId: string | null,
  onText: (text: string) => void,
): Promise<{ text: string; cited: Cited[] }> {
  const res = await streamingFetch(`${config.apiBaseUrl}/api/ask`, {
    method: "POST",
    headers: await headers(true),
    body: JSON.stringify({ question, meetingId }),
  });
  if (!res.ok) throw await errorOf(res);
  let cited: Cited[] = [];
  try {
    const raw = res.headers.get("x-cited-meetings");
    if (raw) cited = JSON.parse(decodeURIComponent(raw)) as Cited[];
  } catch {}
  let text = "";
  const reader = res.body?.getReader();
  if (!reader) {
    text = await res.text();
    onText(text);
    return { text, cited };
  }
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  return { text, cited };
}

export type AskHistoryRow = { role: "user" | "assistant"; content: string; cited_meeting_ids?: string[]; created_at?: string };

export async function askHistory(): Promise<AskHistoryRow[]> {
  const j = await api<{ messages?: AskHistoryRow[] }>("GET", "/api/ask");
  return j.messages ?? [];
}

// ── Push ──

export const registerDevice = (expo_token: string, app_version: string) =>
  api("POST", "/api/push/devices", { expo_token, platform: "ios", app_version });
export const unregisterDevice = (expo_token: string) => api("DELETE", "/api/push/devices", { expo_token });

// ── Sign-up (access code is checked on the server) ──

export const signUp = (b: { code: string; name: string; email: string; password: string }) =>
  api("POST", "/api/signup", b, false);

// ── WHOOP connect ──

/** Result codes after WHOOP's sign-in: shadowforum://me?whoop=<code> (app flows) or /me?whoop=<code> (web, or an unknown state). */
export const WHOOP_RESULT: Record<string, { ok: boolean; text: string }> = {
  ok: { ok: true, text: "WHOOP connected. Your history is syncing." },
  connected: { ok: true, text: "WHOOP connected. Your history is syncing." },
  denied: { ok: false, text: "WHOOP connection cancelled." },
  error: { ok: false, text: "WHOOP couldn't be connected. Try again." },
  external: { ok: false, text: "Your WHOOP data already comes from another sync." },
  taken: { ok: false, text: "That WHOOP account is connected to another member." },
  unconfigured: { ok: false, text: "WHOOP isn't set up on the server yet." },
};

/**
 * POST /api/whoop/connect → { url }: a WHOOP authorize URL whose state is bound to this member
 * on the server (single use, 10 minutes). Returns null when the server doesn't offer it yet.
 */
export async function whoopConnectUrl(): Promise<string | null> {
  try {
    const j = await api<{ url?: string }>("POST", "/api/whoop/connect");
    return j.url ?? null;
  } catch (e) {
    if (e instanceof ApiError && [404, 405].includes(e.status)) return null;
    if (e instanceof ApiError && (e.message === "external" || e.message === "unconfigured")) throw new ApiError(WHOOP_RESULT[e.message].text, e.status);
    throw e;
  }
}
