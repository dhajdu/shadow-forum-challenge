// The five participants and their assigned coach (who they do the monthly
// 1-on-1 with, and who shares their 5M penalty). Coaches are assigned here —
// riders don't pick their own. Matching is by normalized full name.

export const PARTICIPANTS = [
  "Dave Hajdu",
  "Dru Nguyen",
  "Vinh Nguyen",
  "Trung Nguyen",
  "Tuan Anh Le",
] as const;

// coachOf[person] = the person who coaches them.
const COACH_OF: Record<string, string> = {
  "dave hajdu": "Dru Nguyen",
  "dru nguyen": "Dave Hajdu",
  "vinh nguyen": "Tuan Anh Le",
  "trung nguyen": "Vinh Nguyen",
  "tuan anh le": "Trung Nguyen",
};

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The assigned coach's display name for a given rider, or null if not on the roster. */
export function coachNameFor(fullName: string): string | null {
  return COACH_OF[normalizeName(fullName)] ?? null;
}
