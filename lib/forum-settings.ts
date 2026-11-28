// The forum's settings: name, organisation, currency, dues, time zone, site and
// feature switches, from the one forum_settings row (migration 0033).
//
// Server-only. Read with the service role so pages that render before sign-in
// (landing, metadata, password reset) and cron jobs get the same values; the
// row holds nothing secret. Cached across requests under FORUM_SETTINGS_TAG
// (the admin save calls revalidateTag) and once per request with React cache.
// Client components get the public part through <ForumSettingsProvider>; Ask
// and MCP read it on the member's session with readForumSettings (forum-config).
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FORUM_SETTINGS, readForumSettingsOrThrow, type ForumSettings } from "@/lib/forum-config";

export * from "@/lib/forum-config";

export const FORUM_SETTINGS_TAG = "forum-settings";

// The row, plus the names of everyone on the coach roster (pages show names; the roster holds ids).
async function readRow(): Promise<ForumSettings> {
  const admin = createAdminClient();
  const s = await readForumSettingsOrThrow(admin);
  const ids = [...new Set([...Object.keys(s.coaches), ...Object.values(s.coaches)])];
  if (ids.length === 0) return s;
  const { data } = await admin.from("profiles").select("id, full_name").in("id", ids);
  return { ...s, rosterNames: Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name])) };
}

const readCached = unstable_cache(readRow, ["forum-settings"], { tags: [FORUM_SETTINGS_TAG], revalidate: 3600 });

async function load(): Promise<ForumSettings> {
  try {
    return await readCached();
  } catch (e) {
    // Outside a Next request (tests, scripts) unstable_cache has no cache: read directly.
    if (e instanceof Error && e.message.includes("incrementalCache missing")) {
      return readRow().catch(() => DEFAULT_FORUM_SETTINGS);
    }
    return DEFAULT_FORUM_SETTINGS;
  }
}

/** The forum's settings, once per request. Never throws; falls back to DEFAULT_FORUM_SETTINGS. */
export const getForumSettings = cache(load);
