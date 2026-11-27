// Nightly copy of the Shadow forum's coming dates from EO Vietnam into meetings.
//
// EO Vietnam owns future dates; this app never has them typed in by hand. Rows
// arrive as status 'planned' and become 'held' when an agenda is imported.
// The endpoint is not approved yet: with EOVN_FORUM_DATES_URL unset, the job
// skips. Expected response (read-only, Shadow forum only):
//   { "meetings": [{ "id": "…", "date": "2026-12-23", "starts_at": "…", "place": "…", "title": "…", "kind": "forum" }] }
// A bare array, `forum_meetings`, `held_on` / `meeting_date` and `location` are accepted too.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { pushToAll } from "@/lib/push";

type Admin = SupabaseClient<Database>;
type Kind = "forum" | "retreat" | "kickoff";

export type EovnMeeting = {
  eovn_meeting_id: string;
  held_on: string;
  starts_at: string | null;
  place: string | null;
  title: string | null;
  kind: Kind;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** Parse the endpoint's JSON. Throws if the shape is wrong, so a bad feed changes nothing. */
export function parseEovnMeetings(body: unknown): EovnMeeting[] {
  const obj = body as Record<string, unknown> | null;
  const list = Array.isArray(body) ? body : (obj?.meetings ?? obj?.forum_meetings);
  if (!Array.isArray(list)) throw new Error("EO Vietnam response has no meetings list");

  const out: EovnMeeting[] = [];
  for (const raw of list as Record<string, unknown>[]) {
    const id = raw?.id == null ? null : String(raw.id);
    const day = (str(raw?.date) ?? str(raw?.held_on) ?? str(raw?.meeting_date))?.slice(0, 10) ?? null;
    if (!id || !day || !DAY.test(day)) continue;
    const kind = str(raw.kind);
    out.push({
      eovn_meeting_id: id,
      held_on: day,
      starts_at: str(raw.starts_at),
      place: str(raw.place) ?? str(raw.location),
      title: str(raw.title),
      kind: kind === "retreat" || kind === "kickoff" ? kind : "forum",
    });
  }
  return out;
}

export type ForumDatesResult =
  | { skipped: string }
  | { fetched: number; inserted: number; updated: number; linked: number; removed: number };

export async function syncForumDates(admin: Admin, now = new Date()): Promise<ForumDatesResult> {
  const url = process.env.EOVN_FORUM_DATES_URL;
  const token = process.env.EOVN_FORUM_DATES_TOKEN;
  if (!url || !token) return { skipped: "EOVN_FORUM_DATES_URL or EOVN_FORUM_DATES_TOKEN not set" };

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`EO Vietnam responded ${res.status}`);

  const today = now.toISOString().slice(0, 10);
  const coming = parseEovnMeetings(await res.json()).filter((m) => m.held_on >= today);

  const { data: existing, error } = await admin
    .from("meetings")
    .select("id, held_on, status, eovn_meeting_id, place, title, starts_at")
    .gte("held_on", today);
  if (error) throw new Error(error.message);
  const rows = existing ?? [];

  let inserted = 0, updated = 0, linked = 0, removed = 0;
  for (const m of coming) {
    const byId = rows.find((r) => r.eovn_meeting_id === m.eovn_meeting_id);
    const fields = { held_on: m.held_on, starts_at: m.starts_at, place: m.place, title: m.title, updated_at: new Date().toISOString() };
    if (byId) {
      const { error: e } = await admin.from("meetings").update(fields).eq("id", byId.id);
      if (e) throw new Error(e.message);
      updated++;
      continue;
    }
    // A meeting already on that date (imported from Lark) gets linked, not duplicated.
    const sameDay = rows.find((r) => r.held_on === m.held_on && !r.eovn_meeting_id);
    if (sameDay) {
      const { error: e } = await admin
        .from("meetings")
        .update({
          eovn_meeting_id: m.eovn_meeting_id,
          starts_at: sameDay.starts_at ?? m.starts_at,
          place: sameDay.place ?? m.place,
          title: sameDay.title ?? m.title,
          updated_at: fields.updated_at,
        })
        .eq("id", sameDay.id);
      if (e) throw new Error(e.message);
      sameDay.eovn_meeting_id = m.eovn_meeting_id;
      linked++;
      continue;
    }
    const { data: row, error: e } = await admin
      .from("meetings")
      .insert({ ...fields, kind: m.kind, status: "planned", eovn_meeting_id: m.eovn_meeting_id })
      .select("id")
      .single();
    if (e || !row) throw new Error(e?.message ?? "insert failed");
    inserted++;
    // "Next forum: Wed 23 Dec, 6 pm" to members who can see that date. A failed push never fails the copy.
    await pushToAll(admin, { kind: "next_forum", heldOn: m.held_on, startsAt: m.starts_at }).catch(() => null);
  }

  // A coming date EO Vietnam no longer lists was moved or cancelled there.
  const live = new Set(coming.map((m) => m.eovn_meeting_id));
  const gone = rows.filter((r) => r.status === "planned" && r.eovn_meeting_id && !live.has(r.eovn_meeting_id));
  for (const r of gone) {
    const { error: e } = await admin.from("meetings").delete().eq("id", r.id).eq("status", "planned");
    if (e) throw new Error(e.message);
    removed++;
  }

  return { fetched: coming.length, inserted, updated, linked, removed };
}
