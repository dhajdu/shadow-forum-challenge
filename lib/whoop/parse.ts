// Parse a WHOOP physiological_cycles CSV export into daily rows.
// The ranked contest metric is configurable here.

export const RANKED_METRIC = "recovery" as const; // score = Recovery score %

export type WhoopDay = {
  day: string; // YYYY-MM-DD
  recovery: number | null;
  strain: number | null;
  resting_hr: number | null;
  hrv: number | null;
  score: number | null;
};

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

export function parseCycles(text: string): WhoopDay[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const header = splitLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.findIndex((h) => h === name.toLowerCase());

  const iStart = idx("cycle start time");
  const iRec = idx("recovery score %");
  const iRhr = idx("resting heart rate (bpm)");
  const iHrv = idx("heart rate variability (ms)");
  const iStrain = idx("day strain");

  const byDay = new Map<string, WhoopDay>();

  for (let r = 1; r < lines.length; r++) {
    const cols = splitLine(lines[r]);
    const start = cols[iStart]?.trim();
    if (!start) continue;
    const day = start.slice(0, 10); // YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;

    const recovery = num(cols[iRec]);
    const row: WhoopDay = {
      day,
      recovery,
      strain: num(cols[iStrain]),
      resting_hr: num(cols[iRhr]),
      hrv: num(cols[iHrv]),
      score: recovery, // RANKED_METRIC = recovery
    };
    // last row for a given day wins (export is newest-first, but idempotent either way)
    if (!byDay.has(day)) byDay.set(day, row);
  }

  return Array.from(byDay.values());
}
