// Copied from app/_data/vision.ts for the app (pure, no imports). Keep the two in step.
// The forum's vision lives in the "Home of the Shadow" library doc (slug "home"), so Dave can edit it.
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

export function parseVision(md: string): Vision {
  return { is: quoteUnder(md, /shadow forum is/i), ambition: quoteUnder(md, /ambition/i) };
}
