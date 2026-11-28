// The forum's vision lives in the "home" library doc, so the moderator can edit it.
export type Vision = { is: string | null; ambition: string | null };

/** The quote under a "# … <title>" heading. */
function quoteUnder(md: string, title: RegExp): string | null {
  const lines = md.split("\n");
  const i = lines.findIndex((l) => /^#{1,3}\s/.test(l) && title.test(l));
  if (i < 0) return null;
  const out: string[] = [];
  for (const l of lines.slice(i + 1)) {
    if (/^#{1,3}\s/.test(l)) break;
    const q = l.match(/^>\s?(.*)$/);
    if (q && q[1].trim()) out.push(q[1].trim());
    else if (out.length && !l.trim()) break;
  }
  return out.join(" ") || null;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The "<short name> is" quote (e.g. "# The Lantern Forum is") and the ambition. */
export function parseVision(md: string, shortName: string): Vision {
  return { is: quoteUnder(md, new RegExp(`${escape(shortName)} is`, "i")), ambition: quoteUnder(md, /ambition/i) };
}
