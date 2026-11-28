// Shared plumbing for the data module: demo persona, sample fallback, error handling.
import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { fixtures, type FixtureSet, type Persona } from "./fixtures";

const demoPersona = (config.demoPersona || null) as Persona | null;
export const isDemo = demoPersona !== null;
export const fx = (): FixtureSet => fixtures[demoPersona ?? "founding"];

// ── "sample" state, observable by the SampleNote banner ──
let sample = isDemo;
const sampleListeners = new Set<() => void>();
export const sampleState = {
  get: () => sample,
  subscribe(l: () => void) {
    sampleListeners.add(l);
    return () => void sampleListeners.delete(l);
  },
};
export function markSample() {
  if (sample) return;
  sample = true;
  sampleListeners.forEach((l) => l());
}

export type PgError = { message: string; code?: string } | null;
// 42P01 undefined_table, 42703 undefined_column, PGRST2xx schema cache misses.
export const SCHEMA_MISSING = new Set(["42P01", "42703", "PGRST205", "PGRST204", "PGRST200"]);

export function must<R extends { data: unknown; error: PgError }>(r: R): NonNullable<R["data"]> {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<R["data"]>;
}

export const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));

/** Live forum query; falls back to the sample only when the table or column isn't migrated yet. */
export async function forum<T>(
  live: () => PromiseLike<{ data: unknown; error: PgError }>,
  fallback: () => T,
  map: (d: unknown) => T = (d) => d as T,
): Promise<T> {
  if (isDemo) return wait(fallback());
  const r = await live();
  if (r.error?.code && SCHEMA_MISSING.has(r.error.code)) {
    markSample();
    return fallback();
  }
  if (r.error) throw new Error(r.error.message);
  return map(r.data);
}

export async function uid(): Promise<string> {
  if (isDemo) return fx().profile.id;
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not signed in.");
  return id;
}

