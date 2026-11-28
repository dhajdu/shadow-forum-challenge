// A public demo site: visitors sign in to one shared member account that can
// read everything a member reads but change nothing. Set NEXT_PUBLIC_DEMO_LOGIN
// to "email|password" on the demo only; anyone who opens the landing page sees
// it. Unset, which is every real forum, nothing here does anything.

export type DemoLogin = { email: string; password: string };

export function demoLogin(): DemoLogin | null {
  const [email, password] = (process.env.NEXT_PUBLIC_DEMO_LOGIN ?? "").split("|").map((s) => s.trim());
  return email && password ? { email: email.toLowerCase(), password } : null;
}

export function isDemoEmail(email: string | null | undefined): boolean {
  const demo = demoLogin();
  return !!demo && !!email && email.toLowerCase() === demo.email;
}

/** What the demo account may still send: reads, and Ask AI questions (Ask AI writes nothing). */
export function demoMayRequest(method: string, path: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS" || path === "/api/ask";
}

export const DEMO_READ_ONLY = "This is a read-only demo. Nothing you change here is saved.";
