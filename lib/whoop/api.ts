import { WHOOP_API_ORIGIN } from "@/lib/whoop/config";
import { WhoopApiError, whoopRequest } from "@/lib/whoop/http";

type Page<T> = { records?: T[]; next_token?: string | null };

/** Follow `next_token` until the collection ends. Stops on a repeated token or after 50 pages. */
export async function collectPages<T>(
  fetchPage: (nextToken: string | null) => Promise<Page<T>>
): Promise<T[]> {
  const out: T[] = [];
  const seen = new Set<string>();
  let next: string | null = null;
  for (let page = 0; page < 50; page++) {
    const body = await fetchPage(next);
    if (body.records?.length) out.push(...body.records);
    const token = body.next_token || null;
    if (!token || seen.has(token)) break;
    seen.add(token);
    next = token;
  }
  return out;
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new WhoopApiError(res.status, text);
  return (text ? JSON.parse(text) : {}) as T;
}

export async function whoopJson<T>(
  path: string,
  accessToken: string,
  query?: Record<string, string | undefined>,
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  const url = new URL(path, WHOOP_API_ORIGIN);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) url.searchParams.set(key, value);
    }
  }
  const res = await whoopRequest(url.toString(), { method: "GET", accessToken }, fetchImpl);
  return readJson<T>(res);
}

/** 404 is "not scored yet" / gone. Anything else throws, including 401 so the caller can refresh. */
export async function whoopJsonOrNull<T>(
  path: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<T | null> {
  try {
    return await whoopJson<T>(path, accessToken, undefined, fetchImpl);
  } catch (err) {
    if (err instanceof WhoopApiError && err.status === 404) return null;
    throw err;
  }
}

export async function listWhoop<T>(
  path: string,
  accessToken: string,
  query: Record<string, string | undefined>,
  fetchImpl: typeof fetch = fetch
): Promise<T[]> {
  return collectPages((nextToken) =>
    whoopJson<Page<T>>(
      path,
      accessToken,
      { limit: "25", ...query, nextToken: nextToken ?? undefined },
      fetchImpl
    )
  );
}
