// Pure parts of app/_data/kitty.ts, copied for the app. Keep the two in step.
export type KittyCategory = "dues" | "fine" | "penalty" | "retreat" | "forum_away" | "after_forum" | "space_rental" | "other";
export type KittyEntry = {
  id: string;
  entry_on: string;
  direction: "in" | "out";
  amount_vnd: number;
  category: KittyCategory;
  member_id: string | null;
  meeting_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  voided_at: string | null;
  voided_by: string | null;
};
export type Kitty = { balance: number | null; treasurerId: string | null; dues: number; entries: KittyEntry[] };

export const CATEGORY_LABEL: Record<KittyCategory, string> = {
  dues: "Forum dues",
  fine: "Fine",
  penalty: "Contest penalty",
  retreat: "Retreat",
  forum_away: "Forum Away",
  after_forum: "After Forum",
  space_rental: "Space Rental",
  other: "Other",
};
export const IN_CATEGORIES: KittyCategory[] = ["dues", "fine", "penalty", "other"];
export const OUT_CATEGORIES: KittyCategory[] = ["after_forum", "space_rental", "forum_away", "retreat", "other"];

/** "12.5M" / "750k" / "2,500,000" for VND amounts. */
export function vndShort(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1_000_000) return `${sign}${Number((a / 1_000_000).toFixed(a % 100_000 ? 2 : 1))}M`;
  if (a >= 1_000) return `${sign}${Number((a / 1_000).toFixed(a % 1_000 ? 1 : 0))}k`;
  return `${sign}${a}`;
}
export const vndFull = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en-US")} VND`;

/** "2.5M", "2,500,000", "750k" → 2500000 / 750000. Null if it is not a positive amount. */
export function parseVnd(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/vnd|₫|đ|\s/g, "");
  const m = s.match(/^(\d+(?:[.,]\d+)?)(m|k|tr)?$/);
  if (m && m[2]) {
    const v = Number(m[1].replace(",", "."));
    return Math.round(v * (m[2] === "k" ? 1_000 : 1_000_000)) || null;
  }
  const digits = s.replace(/[.,]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const v = Number(digits);
  return v > 0 && v < 1e12 ? v : null;
}

