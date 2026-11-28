// Forum settings types, the fallback values and a reader that takes any client.
// Safe to import anywhere (client components too); the cached server loader is
// lib/forum-settings.ts.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Organisation = "EO" | "YPO" | "other";

export type ForumSettings = {
  name: string; // e.g. "The Night Owls Forum"
  shortName: string; // e.g. "Night Owls"
  organisation: Organisation;
  currency: string; // ISO 4217, e.g. "VND"
  duesPerForum: number; // per member per forum, in whole units of currency
  timeZone: string; // IANA, e.g. "Asia/Singapore"
  siteUrl: string; // no trailing slash
  whoopEnabled: boolean;
  /** Rider (normalised full name) → coach's full name. */
  coaches: Record<string, string>;
};

/** What the browser may see (everything but the coach roster). */
export type PublicForumSettings = Omit<ForumSettings, "coaches">;

/** Used only when the row cannot be read (no keys at build time, database down). Neutral on purpose: each forum's own values live in its forum_settings row. */
export const DEFAULT_FORUM_SETTINGS: ForumSettings = {
  name: "Our Forum",
  shortName: "Forum",
  organisation: "EO",
  currency: "USD",
  duesPerForum: 0,
  timeZone: "UTC",
  siteUrl: "",
  whoopEnabled: true,
  coaches: {},
};

export function publicSettings(s: ForumSettings): PublicForumSettings {
  const { coaches, ...rest } = s;
  void coaches;
  return rest;
}

/** "Night Owls Forum" → "night-owls-forum": the MCP server name and file names. */
export const forumSlug = (s: Pick<ForumSettings, "shortName">) =>
  s.shortName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "forum";

export type ForumSettingsRow = {
  name: string;
  short_name: string;
  organisation: Organisation;
  currency: string;
  dues_per_forum: number | string;
  time_zone: string;
  site_url: string;
  whoop_enabled: boolean;
  coaches: Record<string, string> | null;
};

export const FORUM_SETTINGS_COLUMNS = "name, short_name, organisation, currency, dues_per_forum, time_zone, site_url, whoop_enabled, coaches";

export function fromRow(r: ForumSettingsRow): ForumSettings {
  return {
    name: r.name,
    shortName: r.short_name,
    organisation: r.organisation,
    currency: r.currency,
    duesPerForum: Number(r.dues_per_forum),
    timeZone: r.time_zone,
    siteUrl: r.site_url.replace(/\/+$/, ""),
    whoopEnabled: r.whoop_enabled,
    coaches: r.coaches ?? {},
  };
}

/** Read the row with the given client. Throws if it cannot (e.g. RLS: not an active member). */
export async function readForumSettingsOrThrow(db: unknown): Promise<ForumSettings> {
  const { data, error } = await (db as SupabaseClient).from("forum_settings").select(FORUM_SETTINGS_COLUMNS).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "forum_settings row missing");
  return fromRow(data as ForumSettingsRow);
}

/**
 * Read the row on a member's own session (Ask and MCP, which never use the
 * service role). Falls back to DEFAULT_FORUM_SETTINGS.
 */
export async function readForumSettings(db: unknown): Promise<ForumSettings> {
  return readForumSettingsOrThrow(db).catch(() => DEFAULT_FORUM_SETTINGS);
}
