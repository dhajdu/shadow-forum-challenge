// The five participants and their assigned coach (who they do the monthly
// 1-on-1 with, and who shares their 5M penalty). Coaches are assigned here —
// riders don't pick their own. Matching is by normalized full name.

// Names match the profiles as each rider actually signed up.
export const PARTICIPANTS = [
  "Dave Hajdu",
  "Dru Nguyen",
  "Vinh Nguyen",
  "Tran Trung",
  "Anh Le",
] as const;

// coachOf[person] = the person who coaches them.
// Single cycle (Dave→Vinh→Dru→Anh Le→Tran Trung→Dave): everyone coaches exactly
// one and is coached by exactly one, with no self-coaching and no reciprocal pairs.
const COACH_OF: Record<string, string> = {
  "vinh nguyen": "Dave Hajdu",
  "dru nguyen": "Vinh Nguyen",
  "anh le": "Dru Nguyen",
  "tran trung": "Anh Le",
  "dave hajdu": "Tran Trung",
};

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The assigned coach's display name for a given rider, or null if not on the roster. */
export function coachNameFor(fullName: string): string | null {
  return COACH_OF[normalizeName(fullName)] ?? null;
}

/** The full roster as rider → coach pairs, for display. */
export function coachingPairs(): { rider: string; coach: string }[] {
  return PARTICIPANTS.map((rider) => ({ rider, coach: coachNameFor(rider) ?? "—" }));
}
