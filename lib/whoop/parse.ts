// Parse a WHOOP physiological_cycles CSV export into daily rows.
// The ranked contest score is a blend of recovery, sleep and strain.

export type WhoopDay = {
  day: string; // YYYY-MM-DD
  recovery: number | null;
  sleep: number | null; // sleep performance %
  strain: number | null;
  resting_hr: number | null;
  hrv: number | null;
  score: number | null; // blended daily score, 0-100
};

// Blend weights — the daily score averages these normalised 0-100 components.
// Recovery % and Sleep performance % are already 0-100; strain (0-21) is scaled.
export const SCORE_WEIGHTS = { recovery: 1, sleep: 1, strain: 1 };
export const STRAIN_MAX = 21;

/**
 * Blended daily score from the three components. Null unless WHOOP recorded all
 * three; parseCycles then falls back to partialScore rather than zero-filling.
 */
export function blendScore(
  recovery: number | null,
  sleep: number | null,
  strain: number | null
): number | null {
  if (recovery == null || sleep == null || strain == null) return null;
  const parts: number[] = [];
  for (let i = 0; i < SCORE_WEIGHTS.recovery; i++) parts.push(recovery);
  for (let i = 0; i < SCORE_WEIGHTS.sleep; i++) parts.push(sleep);
  for (let i = 0; i < SCORE_WEIGHTS.strain; i++) parts.push(Math.min(100, (strain / STRAIN_MAX) * 100));
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10;
}

/** Average of whichever components are present, for a day WHOOP didn't fully record. */
function partialScore(recovery: number | null, sleep: number | null, strain: number | null): number | null {
  const parts = [recovery, sleep, strain == null ? null : Math.min(100, (strain / STRAIN_MAX) * 100)].filter(
    (v): v is number => v != null
  );
  if (parts.length === 0) return null;
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10;
}

// minimal CSV line splitter that respects double-quoted fields
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

// WHOOP cycles run sleep-to-sleep, so a cycle that starts in the evening is the
// next day you wake up to. Label cycles by that wake day. The cycles CSV has a
// "Wake onset" column (see wakeDay); without it, start at/after 6pm → next date.
const WAKE_CUTOFF_HOUR = 18;

// The calendar date of the cycle's wake onset. Survives time zone changes that
// push bedtime before the 6pm cutoff (e.g. flying west, asleep at 5pm local).
function wakeDay(wake: string | undefined): string | null {
  const parts = cycleStart(wake);
  if (!parts) return null;
  const [y, mo, d] = parts;
  return new Date(Date.UTC(y, mo - 1, d)).toISOString().slice(0, 10);
}

export function cycleDay(start: string | undefined): string | null {
  const parts = cycleStart(start);
  if (!parts) return null;
  const [y, mo, d, h] = parts;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (h >= WAKE_CUTOFF_HOUR) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

// WHOOP writes ISO "2026-10-11 22:05:00". A CSV that was opened and re-saved in
// Excel/Numbers comes back as "10/11/26 22:05" (US month-first, 2- or 4-digit
// year). Accept both; if the first number can't be a month, read it day-first.
function cycleStart(start: string | undefined): [number, number, number, number] | null {
  const t = start?.trim() ?? "";
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2})/);
  if (iso) return [+iso[1], +iso[2], +iso[3], +iso[4]];
  const us = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?:[ T](\d{1,2}))?/);
  if (!us) return null;
  let mo = +us[1];
  let d = +us[2];
  if (mo > 12) [mo, d] = [d, mo];
  const y = us[3].length === 2 ? 2000 + +us[3] : +us[3];
  return [y, mo, d, us[4] == null ? 0 : +us[4]];
}

const num = (v: string | undefined): number | null => {
  if (v == null) return null;
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** True when the header looks like a WHOOP physiological_cycles export. */
export function isCyclesCsv(text: string): boolean {
  const header = text.slice(0, text.indexOf("\n")).toLowerCase();
  return header.includes("recovery score") && header.includes("cycle start time");
}

export type JournalEntry = {
  day: string; // YYYY-MM-DD (cycle start)
  question: string;
  answered_yes: boolean | null;
  notes: string | null;
};

/** True when the header looks like a WHOOP journal_entries export. */
export function isJournalCsv(text: string): boolean {
  const header = text.slice(0, text.indexOf("\n")).toLowerCase();
  return header.includes("question text") && header.includes("cycle start time");
}

export function parseJournal(text: string): JournalEntry[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const header = splitLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.findIndex((h) => h === name);
  const iStart = idx("cycle start time");
  const iQ = idx("question text");
  const iYes = idx("answered yes");
  const iNotes = idx("notes");

  const byKey = new Map<string, JournalEntry>();
  for (let r = 1; r < lines.length; r++) {
    const cols = splitLine(lines[r]);
    const day = cycleDay(cols[iStart]);
    const question = cols[iQ]?.trim();
    if (!day || !question) continue;
    const yes = cols[iYes]?.trim().toLowerCase();
    const notes = iNotes >= 0 ? cols[iNotes]?.trim() : "";
    const key = `${day}|${question}`;
    if (!byKey.has(key))
      byKey.set(key, {
        day,
        question,
        answered_yes: yes === "true" ? true : yes === "false" ? false : null,
        notes: notes || null,
      });
  }
  return Array.from(byKey.values());
}

export function parseCycles(text: string): WhoopDay[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const header = splitLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.findIndex((h) => h === name.toLowerCase());

  const iStart = idx("cycle start time");
  const iRec = idx("recovery score %");
  const iSleep = idx("sleep performance %");
  const iRhr = idx("resting heart rate (bpm)");
  const iHrv = idx("heart rate variability (ms)");
  const iStrain = idx("day strain");
  const iWake = idx("wake onset");

  const byDay = new Map<string, WhoopDay>();

  for (let r = 1; r < lines.length; r++) {
    const cols = splitLine(lines[r]);
    const day = (iWake >= 0 ? wakeDay(cols[iWake]) : null) ?? cycleDay(cols[iStart]); // the wake day, YYYY-MM-DD
    if (!day) continue;

    const recovery = num(cols[iRec]);
    const sleep = iSleep >= 0 ? num(cols[iSleep]) : null;
    const strain = num(cols[iStrain]);
    const row: WhoopDay = {
      day,
      recovery,
      sleep,
      strain,
      resting_hr: num(cols[iRhr]),
      hrv: num(cols[iHrv]),
      score: blendScore(recovery, sleep, strain),
    };
    // one row per day; if two cycles land on the same day (e.g. a nap-split cycle),
    // keep the one with a score
    const prev = byDay.get(day);
    if (!prev || (prev.score == null && row.score != null)) byDay.set(day, row);
  }

  // A day missing a component still counts with the numbers it has: the newest
  // day is usually still in progress at export time (the next upload overwrites
  // it), and WHOOP sometimes records strain but never scores the night's sleep.
  const days = Array.from(byDay.values());
  for (const d of days) if (d.score == null) d.score = partialScore(d.recovery, d.sleep, d.strain);

  return days;
}
