import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { listWhoop, whoopJson, whoopJsonOrNull } from "@/lib/whoop/api";
import { SYNC_LOOKBACK_DAYS, credentialsFromEnv, isExternallySynced } from "@/lib/whoop/config";
import { encryptToken, tokenKeyFromEnv } from "@/lib/whoop/crypto";
import { WhoopApiError } from "@/lib/whoop/http";
import {
  daysFromWhoop,
  toWhoopDayRows,
  type WhoopCycleRecord,
  type WhoopRecoveryRecord,
  type WhoopSleepRecord,
  type WhoopWindow,
} from "@/lib/whoop/map";
import { applyNewestPartial, type WhoopDay } from "@/lib/whoop/parse";
import { revokeWhoopAccess } from "@/lib/whoop/oauth";
import { ensureFreshAccess, forceRefreshAccess, type TokenStore } from "@/lib/whoop/refresh";
import type { WhoopEvent } from "@/lib/whoop/webhook";

type Admin = SupabaseClient<Database>;
type ConnectionRow = Database["public"]["Tables"]["whoop_connections"]["Row"];

export type SyncOutcome = { written: number } | "revoked" | "skipped";

function tokenStore(admin: Admin): TokenStore {
  return {
    async read(userId) {
      const { data, error } = await admin
        .from("whoop_connections")
        .select("status, access_token_enc, refresh_token_enc, token_expires_at, scopes")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        status: data.status,
        accessTokenEnc: data.access_token_enc,
        refreshTokenEnc: data.refresh_token_enc,
        expiresAt: data.token_expires_at,
        scopes: data.scopes,
      };
    },
    async write(userId, patch) {
      const { error } = await admin
        .from("whoop_connections")
        .update({
          status: patch.status,
          access_token_enc: patch.accessTokenEnc,
          refresh_token_enc: patch.refreshTokenEnc,
          token_expires_at: patch.expiresAt,
          scopes: patch.scopes,
          last_error: patch.lastError,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
  };
}

async function withAccess<T>(admin: Admin, userId: string, run: (accessToken: string) => Promise<T>): Promise<T | "revoked"> {
  const args = {
    userId,
    store: tokenStore(admin),
    creds: credentialsFromEnv(),
    key: tokenKeyFromEnv(),
  };
  const first = await ensureFreshAccess(args);
  if ("disconnected" in first) return "revoked";
  try {
    return await run(first.accessToken);
  } catch (err) {
    if (!(err instanceof WhoopApiError) || err.status !== 401) throw err;
    const second = await forceRefreshAccess(args);
    if ("disconnected" in second) return "revoked";
    return await run(second.accessToken);
  }
}

/**
 * Partial-score only when this batch holds the member's newest day. An older
 * incomplete day stays unscored, matching the zip parser on main.
 */
async function finalizeNewest(admin: Admin, userId: string, days: WhoopDay[]): Promise<WhoopDay[]> {
  if (days.length === 0) return days;
  const newest = days.reduce((best, day) => (day.day > best.day ? day : best));
  const { data, error } = await admin
    .from("whoop_days")
    .select("day")
    .eq("user_id", userId)
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.day || newest.day >= data.day) applyNewestPartial(days);
  return days;
}

async function upsertDays(admin: Admin, userId: string, days: WhoopDay[]): Promise<number> {
  if (isExternallySynced(userId)) return 0;
  const rows = toWhoopDayRows(userId, days);
  if (rows.length === 0) return 0;
  const { error } = await admin.from("whoop_days").upsert(rows, { onConflict: "user_id,day" });
  if (error) throw new Error(error.message);
  return rows.length;
}

async function writeWindow(admin: Admin, userId: string, window: WhoopWindow): Promise<number> {
  const days = await finalizeNewest(admin, userId, daysFromWhoop(window));
  return upsertDays(admin, userId, days);
}

function lookbackStart(days: number, now = Date.now()): string {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

async function fetchWindow(accessToken: string, start: string, end?: string): Promise<WhoopWindow> {
  const query = { start, end };
  const [cycles, recoveries, sleeps] = await Promise.all([
    listWhoop<WhoopCycleRecord>("/developer/v2/cycle", accessToken, query),
    listWhoop<WhoopRecoveryRecord>("/developer/v2/recovery", accessToken, query),
    listWhoop<WhoopSleepRecord>("/developer/v2/activity/sleep", accessToken, query),
  ]);
  return { cycles, recoveries, sleeps };
}

async function touchSync(admin: Admin, userId: string, lastError: string | null): Promise<void> {
  await admin
    .from("whoop_connections")
    .update({
      last_sync_at: new Date().toISOString(),
      last_error: lastError,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

/** Re-sync the last `days` of cycles for one connected member. */
export async function syncRecentDays(admin: Admin, userId: string, days = SYNC_LOOKBACK_DAYS): Promise<SyncOutcome> {
  if (isExternallySynced(userId)) return "skipped";
  const result = await withAccess(admin, userId, (accessToken) => fetchWindow(accessToken, lookbackStart(days)));
  if (result === "revoked") return "revoked";
  const written = await writeWindow(admin, userId, result);
  await touchSync(admin, userId, null);
  return { written };
}

async function syncCycle(admin: Admin, userId: string, cycleId: number): Promise<SyncOutcome> {
  if (isExternallySynced(userId)) return "skipped";
  const result = await withAccess(admin, userId, async (accessToken) => {
    const cycle = await whoopJsonOrNull<WhoopCycleRecord>(`/developer/v2/cycle/${cycleId}`, accessToken);
    if (!cycle) return null;
    const [recovery, sleep] = await Promise.all([
      whoopJsonOrNull<WhoopRecoveryRecord>(`/developer/v2/cycle/${cycleId}/recovery`, accessToken),
      whoopJsonOrNull<WhoopSleepRecord>(`/developer/v2/cycle/${cycleId}/sleep`, accessToken),
    ]);
    const window: WhoopWindow = {
      cycles: [cycle],
      recoveries: recovery ? [recovery] : [],
      sleeps: sleep ? [sleep] : [],
    };
    return window;
  });
  if (result === "revoked") return "revoked";
  if (!result) return { written: 0 };
  const written = await writeWindow(admin, userId, result);
  await touchSync(admin, userId, null);
  return { written };
}

type WorkoutRecord = { start?: string | null; end?: string | null };

/** Day strain lives on the cycle, not the workout, so a workout event refetches the cycles around it. */
async function syncWorkout(admin: Admin, userId: string, workoutId: string): Promise<SyncOutcome> {
  if (isExternallySynced(userId)) return "skipped";
  const result = await withAccess(admin, userId, async (accessToken) => {
    const workout = await whoopJsonOrNull<WorkoutRecord>(`/developer/v2/activity/workout/${workoutId}`, accessToken);
    if (!workout?.start) return null;
    const startMs = Date.parse(workout.start);
    const endMs = workout.end ? Date.parse(workout.end) : Date.now();
    const start = new Date((Number.isFinite(startMs) ? startMs : Date.now()) - 36 * 60 * 60 * 1000).toISOString();
    const end = new Date((Number.isFinite(endMs) ? endMs : Date.now()) + 6 * 60 * 60 * 1000).toISOString();
    return fetchWindow(accessToken, start, end);
  });
  if (result === "revoked") return "revoked";
  if (!result) return { written: 0 };
  const written = await writeWindow(admin, userId, result);
  await touchSync(admin, userId, null);
  return { written };
}

async function connectionForWhoopUser(admin: Admin, whoopUserId: number): Promise<ConnectionRow | null> {
  const { data, error } = await admin
    .from("whoop_connections")
    .select("*")
    .eq("whoop_user_id", whoopUserId)
    .eq("status", "connected")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Webhook handler. Updated events refetch that cycle (or the cycles around a
 * workout) and upsert the day. Deleted events are acked; the backup cron
 * reconciles, and deleting a row here would punch a hole in the leaderboard
 * for a nap edit. Idempotent: a repeated trace_id just upserts the same day.
 */
export async function handleWhoopEvent(admin: Admin, event: WhoopEvent): Promise<SyncOutcome> {
  const connection = await connectionForWhoopUser(admin, event.user_id);
  if (!connection) return "skipped";
  if (isExternallySynced(connection.user_id)) return "skipped";
  if (!event.type.endsWith(".updated")) return "skipped";

  if (event.type === "workout.updated") return syncWorkout(admin, connection.user_id, String(event.id));

  if (event.type === "sleep.updated" || event.type === "recovery.updated") {
    const loaded = await withAccess(admin, connection.user_id, (accessToken) =>
      whoopJsonOrNull<{ cycle_id?: number }>(`/developer/v2/activity/sleep/${event.id}`, accessToken)
    );
    if (loaded === "revoked") return "revoked";
    if (!loaded?.cycle_id) return { written: 0 };
    return syncCycle(admin, connection.user_id, loaded.cycle_id);
  }

  return "skipped";
}

export type WhoopProfile = {
  user_id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
};

export async function fetchWhoopProfile(accessToken: string): Promise<WhoopProfile> {
  return whoopJson<WhoopProfile>("/developer/v2/user/profile/basic", accessToken);
}

export async function saveConnection(
  admin: Admin,
  userId: string,
  profile: WhoopProfile,
  stored: { accessToken: string; refreshToken: string; expiresAt: string; scopes: string | null }
): Promise<{ error: string | null }> {
  const key = tokenKeyFromEnv();
  const now = new Date().toISOString();
  const { error } = await admin.from("whoop_connections").upsert(
    {
      user_id: userId,
      whoop_user_id: profile.user_id,
      status: "connected",
      access_token_enc: encryptToken(stored.accessToken, key),
      refresh_token_enc: encryptToken(stored.refreshToken, key),
      token_expires_at: stored.expiresAt,
      scopes: stored.scopes,
      connected_at: now,
      last_error: null,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
  if (!error) return { error: null };
  if (error.code === "23505") return { error: "That WHOOP account is already linked to another member." };
  return { error: error.message };
}

/** Revoke at WHOOP (best effort) and delete the stored ciphertext. */
export async function disconnectUser(admin: Admin, userId: string): Promise<void> {
  const { data } = await admin
    .from("whoop_connections")
    .select("status, access_token_enc, refresh_token_enc, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.status === "connected" && data.access_token_enc) {
    try {
      const access = await ensureFreshAccess({
        userId,
        store: tokenStore(admin),
        creds: credentialsFromEnv(),
        key: tokenKeyFromEnv(),
      });
      if ("accessToken" in access) await revokeWhoopAccess(access.accessToken);
    } catch {
      // Local delete still happens. A failed revoke must not keep the tokens.
    }
  }

  await admin.from("whoop_connections").delete().eq("user_id", userId);
}

export type BackupReport = {
  synced: number;
  skipped: number;
  disconnected: number;
  failed: string[];
};

/** Backup pass: last ~10 days for every connected member. One bad token does not stop the rest. */
export async function syncAllConnected(admin: Admin): Promise<BackupReport> {
  const report: BackupReport = { synced: 0, skipped: 0, disconnected: 0, failed: [] };
  const { data, error } = await admin.from("whoop_connections").select("user_id").eq("status", "connected");
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    if (isExternallySynced(row.user_id)) {
      report.skipped++;
      continue;
    }
    try {
      const outcome = await syncRecentDays(admin, row.user_id, SYNC_LOOKBACK_DAYS);
      if (outcome === "revoked") report.disconnected++;
      else if (outcome === "skipped") report.skipped++;
      else report.synced++;
    } catch (err) {
      const message = (err instanceof Error ? err.message : "sync failed").slice(0, 300);
      report.failed.push(row.user_id);
      await admin
        .from("whoop_connections")
        .update({ last_error: message, updated_at: new Date().toISOString() })
        .eq("user_id", row.user_id);
    }
  }
  return report;
}
