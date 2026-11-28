// Each rider's assigned coach (who they do the monthly 1-on-1 with, and who
// shares their missed-goal penalty). Coaches are assigned by the forum, not
// picked by riders. The roster lives in forum_settings.coaches (migrations 0033,
// 0036): rider's profile id → coach's profile id. Only admins write it.
//
// Never match coaches by name: members edit their own names (security review H2).

export type Coaches = Record<string, string>;

/** The assigned coach's profile id for a rider, or null if not on the roster. */
export function coachIdFor(riderId: string, coaches: Coaches): string | null {
  return coaches[riderId] ?? null;
}

/** The assigned coach's display name for a rider (names from getForumSettings().rosterNames), or null. */
export function coachNameFor(riderId: string, s: { coaches: Coaches; rosterNames: Record<string, string> }): string | null {
  const id = coachIdFor(riderId, s.coaches);
  return id ? s.rosterNames[id] ?? null : null;
}
