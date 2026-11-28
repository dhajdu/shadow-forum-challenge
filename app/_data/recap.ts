// Turns an imported agenda (Markdown) into a forum recap: purpose, timed sections and the
// Parking Lot as structured topics. Pure functions; no data access.

export type RecapSection = { title: string; minutes: number | null; body: string };

export type ParkingTopic = { who: string | null; topic: string; details: string[]; nextForum: boolean };
export type ParkingGroup = { date: string | null; label: string; topics: ParkingTopic[] };

export type Recap = {
  purpose: string | null;
  place: string | null;
  sections: RecapSection[];
  parking: ParkingGroup[];
  learnings: string[];
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/** "Nov 25" / "July 28" inside an agenda held on `heldOn` → YYYY-MM-DD (same or previous year). */
function parkingDate(label: string, heldOn: string): string | null {
  const m = label.toLowerCase().match(/([a-z]{3,9})\.?\s+(\d{1,2})/);
  if (!m) return null;
  const month = MONTHS[m[1].slice(0, 4) === "sept" ? "sept" : m[1].slice(0, 3)];
  if (!month) return null;
  const [y, hm] = heldOn.split("-").map(Number);
  const year = month > hm ? y - 1 : y;
  return `${year}-${String(month).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
}

const SKIP = /^(the radar|important\s*\|\s*urgent)$/i;
const DATE_LINE = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(st|nd|rd|th)?:?$/;
const NAME_TOPIC = /^([A-Z][\p{L}.'’]*(?:\s[A-Z][\p{L}.'’]*)?)\s*[-–:]\s*(.+)$/u;
const NAME_ONLY = /^([A-Z][\p{L}.'’]*(?:\s[A-Z][\p{L}.'’]*)?)$/u;

/** A forum's theme: the agenda's Purpose, without a leading "To ". */
export function agendaTheme(md: string | null | undefined): string | null {
  const purpose = md ? parseRecap(md, "").purpose : null;
  if (!purpose) return null;
  const t = purpose.replace(/^to\s+/i, "").replace(/[.\s]+$/, "");
  return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 140);
}

/**
 * The Parking Lot comes in two shapes: grouped by forum date ("**Nov 25**" then "Name - topic"
 * lines, with "--" or unnamed lines as details) or, in early agendas, grouped by person.
 */
function parseParking(body: string, heldOn: string): { groups: ParkingGroup[]; learnings: string[] } {
  const learnings: string[] = [];
  let inLearnings = false;
  const groups: ParkingGroup[] = [];
  let group: ParkingGroup | null = null;
  let topic: ParkingTopic | null = null;
  let person: string | null = null; // person-grouped agendas
  const open = (date: string | null, label: string) => {
    group = { date, label, topics: [] };
    groups.push(group);
    topic = null;
  };
  for (const raw of body.split("\n")) {
    if (/^#\s*learnings/i.test(raw.trim())) {
      inLearnings = true;
      continue;
    }
    if (/^#\s/.test(raw.trim())) break; // another top-level section
    const isSub = /^\s*(--|[-*+]\s)/.test(raw) && /^\s{2,}|^\s*--/.test(raw);
    const text = raw.replace(/\*\*/g, "").replace(/^\s*(--|[-*+])\s*(\[[ xX]\]\s*)?/, "").trim();
    if (!text || SKIP.test(text)) continue;
    if (/^#?\s*learnings:?$/i.test(text)) {
      inLearnings = true;
      continue;
    }
    if (inLearnings) {
      learnings.push(text);
      continue;
    }

    const d = text.match(DATE_LINE);
    const date = d ? parkingDate(`${d[1]} ${d[2]}`, heldOn) : null;
    if (date) {
      person = null;
      open(date, text.replace(/:$/, ""));
      continue;
    }
    const nameOnly = text.match(NAME_ONLY);
    if (nameOnly && /^\s*\*\*/.test(raw)) {
      person = nameOnly[1];
      open(null, person);
      continue;
    }
    if (!group) open(null, "");
    const nextForum = /next forum/i.test(text);
    const clean = text.replace(/\s*[-–]?\s*next forum\s*/i, " ").trim().replace(/[-–]\s*$/, "").trim();
    const named = !isSub ? clean.match(NAME_TOPIC) : null;
    if (named && !DATE_LINE.test(named[1])) {
      topic = { who: named[1], topic: named[2].trim(), details: [], nextForum };
      group!.topics.push(topic);
    } else if (topic && (isSub || !person)) {
      (topic as ParkingTopic).details.push(clean);
      if (nextForum) (topic as ParkingTopic).nextForum = true;
    } else {
      topic = { who: person, topic: clean, details: [], nextForum };
      group!.topics.push(topic);
    }
  }
  return { groups: groups.filter((g) => (g as ParkingGroup).topics.length > 0), learnings };
}

const plain = (s: string) => s.replace(/\*\*/g, "").replace(/^\s*[-*+]\s+(\[[ xX]\]\s*)?/, "").trim();

export function parseRecap(md: string, heldOn: string): Recap {
  const sections: RecapSection[] = [];
  let purpose: string | null = null;
  let place: string | null = null;
  let parking: ParkingGroup[] = [];
  let learnings: string[] = [];

  const parts = md.split(/^##\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const head = (nl < 0 ? part : part.slice(0, nl)).trim();
    const rawBody = nl < 0 ? "" : part.slice(nl + 1);
    let body = rawBody;
    const h1 = body.search(/^#\s/m); // a later top-level section ("# Learnings") is not part of this one
    if (h1 >= 0) body = body.slice(0, h1);
    body = body.trim();
    const lower = head.toLowerCase();
    if (lower.startsWith("purpose")) {
      purpose = body.split("\n").map(plain).filter(Boolean).join(" ") || null;
      continue;
    }
    if (lower.includes("location")) {
      place = body.split("\n").map(plain).filter(Boolean)[0]?.replace(/\.\s*-\s*/, " · ") ?? null;
      continue;
    }
    if (lower.startsWith("parking lot")) {
      ({ groups: parking, learnings } = parseParking(rawBody, heldOn));
      continue;
    }
    const mins = head.match(/(\d+)\s*(?:min|minutes)\b/i);
    const title = head
      .replace(/\(\s*\d+\s*(?:min|minutes)\s*\)/i, "")
      .replace(/\s*-\s*\d+\s*(?:min|minutes)\b.*$/i, "")
      .replace(/\s*-\s*\(.*\)\s*$/, "")
      .replace(/\s*-\s*$/, "")
      .trim();
    sections.push({ title, minutes: mins ? Number(mins[1]) : null, body });
  }
  return { purpose, place, sections, parking, learnings };
}

/**
 * Parking-lot topics a member may see. Each agenda carries the forum's running list, so a newcomer's
 * first agenda would repeat older topics; drop groups dated before their first forum.
 */
export function visibleParking(groups: ParkingGroup[], joinedOn: string | null, founding: boolean): ParkingGroup[] {
  if (founding) return groups;
  if (!joinedOn) return [];
  return groups.filter((g) => g.date != null && g.date >= joinedOn);
}

/**
 * An agenda's Markdown as a member may read it: the Parking Lot section keeps only the topic groups
 * dated from their first forum on (same rule as visibleParking). For Ask, MCP and anything else that
 * hands agenda text to a model.
 */
export function visibleAgendaMd(md: string, heldOn: string, joinedOn: string | null, founding: boolean): string {
  if (founding) return md;
  const at = md.search(/^##\s+parking lot/im);
  if (at < 0) return md;
  const rest = md.slice(at);
  const next = rest.slice(2).search(/^#{1,2}\s(?!\s*learnings)/im); // the section after the Parking Lot
  const section = next < 0 ? rest : rest.slice(0, next + 2);
  const after = next < 0 ? "" : rest.slice(next + 2);
  const { groups, learnings } = parseParking(section.slice(section.indexOf("\n") + 1), heldOn);
  const lines: string[] = ["## Parking Lot", ""];
  for (const g of visibleParking(groups, joinedOn, founding)) {
    if (g.label) lines.push(`**${g.label}**`);
    for (const t of g.topics) {
      lines.push(`- ${t.who ? `${t.who} - ` : ""}${t.topic}${t.nextForum ? " (next forum)" : ""}`);
      for (const d of t.details) lines.push(`  - ${d}`);
    }
    lines.push("");
  }
  if (learnings.length) lines.push("# Learnings", "", ...learnings.map((l) => `- ${l}`), "");
  return `${md.slice(0, at)}${lines.join("\n")}${after ? `\n${after}` : ""}`;
}
