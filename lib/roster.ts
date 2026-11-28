// Each rider's assigned coach (who they do the monthly 1-on-1 with, and who
// shares their missed-goal penalty). Coaches are assigned by the forum, not
// picked by riders. The roster lives in forum_settings.coaches (migration 0033):
// rider's normalised full name → coach's full name. Matching is by name.
//
// Example roster (fictional): a single cycle, so everyone coaches exactly one
// and is coached by exactly one, with no self-coaching and no reciprocal pairs:
//   { "ana souza": "Ben Okafor", "ben okafor": "Chloe Martin", "chloe martin": "Ana Souza" }

export type Coaches = Record<string, string>;

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The assigned coach's display name for a given rider, or null if not on the roster. */
export function coachNameFor(fullName: string, coaches: Coaches): string | null {
  return coaches[normalizeName(fullName)] ?? null;
}
