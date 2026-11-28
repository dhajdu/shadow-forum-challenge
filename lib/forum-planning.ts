// The forum model, served by the MCP connector to whoever is moderating, so the
// rules live in one place instead of in a skill file on each machine.

export const AGENDA_KINDS = [
  "arrival", "welcome", "starters", "merps", "updates", "goals", "presentation", "lifeline",
  "activity", "guest", "break", "housekeeping", "close",
  "travel", "hotel", "meal", "sight", "free", "other",
] as const;
export type AgendaKind = (typeof AGENDA_KINDS)[number];

export type RunSheetLine = { starts_at: string; minutes: number; kind: AgendaKind; title: string };

const at = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

/** Starters: 2 rounds x 1 min per member present, rounded up to 5 minutes. */
export const startersMinutes = (present: number) => Math.ceil((2 * present) / 5) * 5;

/** The standard run sheet for a forum with `present` members, before any extras. */
export function standardRunSheet(present: number): RunSheetLine[] {
  const lines: [number, AgendaKind, string][] = [
    [15, "arrival", "Arrival: Brag, Boast, Moan (the 95%)"],
    [10, "welcome", "Welcome and tone"],
    [startersMinutes(present), "starters", "Conversation starters"],
    [5, "merps", "MERPS"],
    [5 * present, "updates", "5% updates"],
    [20, "goals", "Goals update"],
    [10, "break", "Coffee"],
    [30, "presentation", "Planned presentation"],
    [15, "housekeeping", "Housekeeping, one-word close"],
  ];
  let t = 13 * 60 + 45;
  return lines.map(([minutes, kind, title]) => {
    const line = { starts_at: at(t), minutes, kind, title };
    t += minutes;
    return line;
  });
}

export const PLANNING_GUIDE = `# Planning a forum

You are helping the forum's moderator. The moderator changes every year, so use the forum's data, not memory.

## Every forum has
- A host, who chooses the location. A theme.
- 1:45 Arrival: "Brag, Boast, Moan (the 95%)". 2:00 start.
- Welcome and tone (10).
- Conversation starters on their own line: 2 rounds x 1 min x members present, rounded up to 5.
- MERPS (5), on its own line, right before the updates.
- 5% updates, always the first activity after the starters: 5 min per member present.
- Goals update (20). Coffee (10).
- One planned presentation (30), presenter and coach in rotation. An optional live-coached presentation (30) only if needed.
- Housekeeping at the end (15), then a one-word close.
- Optional: an extra activity (a lifeline is 20 min; pitch decks, press releases, 300-word lifelines at 5 min each), a guest speaker, an after-forum activity.

get_forum_plan returns members_present and a standard_run_sheet already timed for that count. Start from it, add the extras, and recompute every start time.

## Away forums and the retreat
They have planners (get_forum_plan shows them). A retreat is one agenda over several days: use the day field, and the travel, hotel, meal, sight and free kinds for the trip.

## Rotation
In each cycle every member presents once and coaches once. Nobody coaches themselves or presents twice in a row. The retreat can hold two presentations. New members join the next cycle.

## Readiness, 14 days before a forum
Check get_forum_plan's gaps. Draft, never send:
- the host's daily nudge while no location is set;
- the presenter's and coach's pre-coaching reminder;
- the goals reminder, 24 h before at 11:00 GMT+7: "do your forum updates and set your goals".

## Rules
- Members see forums only from their first forum on. Never copy an earlier forum's notes, lifelines or Parking Lot into a newer member's view. A new agenda's Parking Lot starts empty.
- Show the change and get the moderator's OK before every write. Only forum admins can write.
- Never post, message or invite on the moderator's behalf from this guide.
- Lock-screen text never names private content.
- Times are GMT+7. Call people by their first names.
- Show run sheets as a table: time, minutes, item, who. Then the gaps. Then one question.`;
