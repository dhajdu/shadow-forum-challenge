// The forum kitty: ledger lines, balance and treasurer, read on the member's own session.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Db } from "./types";

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

// Money in the forum's currency (forum_settings.currency). Amounts are whole
// units of that currency (the ledger column is a bigint). VND keeps its M/k
// shorthand ("2.5M", "750k"); other currencies use Intl ("$1,250").

const sign = (n: number) => (n < 0 ? "−" : "");
const isVnd = (currency: string) => currency.toUpperCase() === "VND";

function symbol(currency: string): string {
  try {
    const p = new Intl.NumberFormat("en-US", { style: "currency", currency }).formatToParts(0);
    return p.find((x) => x.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

/** Compact number, no symbol: VND "12.5M" / "750k"; others "1,250". Also the kitty form's default amount. */
export function moneyShort(n: number, currency: string): string {
  const a = Math.abs(n);
  if (!isVnd(currency)) return `${sign(n)}${a.toLocaleString("en-US")}`;
  if (a >= 1_000_000) return `${sign(n)}${Number((a / 1_000_000).toFixed(a % 100_000 ? 2 : 1))}M`;
  if (a >= 1_000) return `${sign(n)}${Number((a / 1_000).toFixed(a % 1_000 ? 1 : 0))}k`;
  return `${sign(n)}${a}`;
}

/** Compact with the currency's symbol: VND "12.5M ₫"; USD "$1,250"; EUR "€1,250". */
export function moneyLabel(n: number, currency: string): string {
  if (isVnd(currency)) return `${moneyShort(n, currency)} ₫`;
  const s = symbol(currency);
  return s.length === 1 ? `${sign(n)}${s}${moneyShort(Math.abs(n), currency)}` : `${moneyShort(n, currency)} ${s}`;
}

/** Every digit and the code: "2,500,000 VND" / "1,250 USD". */
export const moneyFull = (n: number, currency: string) => `${sign(n)}${Math.abs(n).toLocaleString("en-US")} ${currency.toUpperCase()}`;

/** Every digit, no code: "2,500,000". */
export const moneyDigits = (n: number) => `${sign(n)}${Math.abs(n).toLocaleString("en-US")}`;

/**
 * "2.5M", "2,500,000", "750k", "$250", "250 USD" → a whole amount. Null if it is
 * not a positive whole amount. VND also reads "2.500.000" and "2tr".
 */
export function parseMoney(input: string, currency: string): number | null {
  const code = currency.toLowerCase();
  const s = input
    .trim()
    .toLowerCase()
    .replace(new RegExp(`${code}|₫|đ|\\s`, "g"), "")
    .replace(/^[^\d.,]+/, "");
  const vnd = isVnd(currency);
  const m = s.match(vnd ? /^(\d+(?:[.,]\d+)?)(m|k|tr)?$/ : /^(\d+(?:\.\d+)?)(m|k)?$/);
  if (m && m[2]) {
    const v = Number(m[1].replace(",", "."));
    return Math.round(v * (m[2] === "k" ? 1_000 : 1_000_000)) || null;
  }
  const digits = vnd ? s.replace(/[.,]/g, "") : s.replace(/,/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const v = Number(digits);
  return v > 0 && v < 1e12 ? v : null;
}

/** The kitty. Dues per forum come from forum_settings (getForumSettings). */
export async function getKitty(db: Db, duesPerForum: number): Promise<Kitty> {
  const sb = db as unknown as SupabaseClient;
  const [bal, settings, rows] = await Promise.all([
    sb.rpc("kitty_balance"),
    sb.from("kitty_settings").select("treasurer_id").maybeSingle(),
    sb
      .from("kitty_entries")
      .select("id, entry_on, direction, amount_vnd, category, member_id, meeting_id, note, created_by, created_at, voided_at, voided_by")
      .order("entry_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  const s = settings.data as { treasurer_id: string | null } | null;
  return {
    balance: bal.error || bal.data == null ? null : Number(bal.data),
    treasurerId: s?.treasurer_id ?? null,
    dues: duesPerForum,
    entries: ((rows.data ?? []) as KittyEntry[]).map((e) => ({ ...e, amount_vnd: Number(e.amount_vnd) })),
  };
}
