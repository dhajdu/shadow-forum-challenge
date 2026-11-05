/**
 * WHOOP sits behind Cloudflare. Requests with Node's default User-Agent
 * (`node` / undici) get 403 error 1010, so every server call sends a browser UA.
 */
export const WHOOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class WhoopApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`WHOOP API ${status}`);
    this.name = "WhoopApiError";
    this.status = status;
    this.body = body;
  }
}

type WhoopRequestInit = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
  accessToken?: string;
};

export async function whoopRequest(
  url: string,
  init: WhoopRequestInit = {},
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const { accessToken, headers: initHeaders, ...rest } = init;
  const headers = new Headers(initHeaders);
  headers.set("User-Agent", WHOOP_USER_AGENT);
  headers.set("Accept", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetchImpl(url, { ...rest, headers });
}
