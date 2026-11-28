// Expo push (global mobile standard). Server-only: runs with the service role.
//
// Lock-screen text is never private: messages come only from the fixed templates
// below. No template takes agenda text, goal text, scores or another member's name.
// Recipients are filtered through the access rule: each push goes only to active
// members, and a push about a meeting only to members who can see that meeting's date.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isActive, loadMembers, memberCanSeeDate, type Member } from "@/lib/access";
import { getForumSettings, type ForumSettings } from "@/lib/forum-settings";
import { localStamp } from "@/app/_data/format";

type Admin = SupabaseClient<Database>;

export type PushMessage =
  | { kind: "next_forum"; heldOn: string; startsAt: string | null }
  | { kind: "new_agenda"; heldOn: string }
  | { kind: "whip_nudge" }
  | { kind: "report_ready"; month: string } // month YYYY-MM
  | { kind: "forum_message"; sentOn: string } // sentOn YYYY-MM-DD, the message's day
  | { kind: "chat_report" }; // to admins: a member reported a chat message

type Forum = Pick<ForumSettings, "name" | "timeZone">;

function when(heldOn: string, startsAt: string | null, timeZone: string): string {
  const d = new Date(startsAt ?? localStamp(timeZone, heldOn));
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone });
  if (!startsAt) return day;
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone }).replace(":00", "").toLowerCase();
  return `${day}, ${time}`;
}

/** The only texts a push can carry. The title is the forum's name. */
export function render(m: PushMessage, forum: Forum): { title: string; body: string; data: Record<string, string> } {
  switch (m.kind) {
    case "next_forum":
      return { title: forum.name, body: `Next forum: ${when(m.heldOn, m.startsAt, forum.timeZone)}`, data: { path: `/forum/${m.heldOn}` } };
    case "new_agenda":
      return { title: forum.name, body: "A new agenda is in Forum", data: { path: `/forum/${m.heldOn}` } };
    case "forum_message":
      return { title: forum.name, body: "New message in the forum chat", data: { path: "/forum/chat" } };
    case "chat_report":
      return { title: forum.name, body: "A chat message was reported", data: { path: "/forum/chat" } };
    case "whip_nudge":
      return { title: "The Whip", body: "Time to sync your WHOOP", data: { path: "/biometrics" } };
    case "report_ready":
    {
      const label = new Date(`${m.month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
      return { title: forum.name, body: `The ${label} report is ready`, data: { path: `/contest/report/${m.month}` } };
    }
  }
}

/** Who may receive this message: active members, and for a meeting only those who can see its date. */
export function mayReceive(m: Member, msg: PushMessage): boolean {
  if (!isActive(m)) return false;
  if (msg.kind === "next_forum" || msg.kind === "new_agenda") return memberCanSeeDate(m, msg.heldOn);
  if (msg.kind === "forum_message") return memberCanSeeDate(m, msg.sentOn);
  return true;
}

export type PushResult = { skipped: string } | { recipients: number; sent: number; revoked: number };

/**
 * Send one message to these members' live devices. Members who may not receive it
 * are dropped silently. Devices Expo reports as unregistered get revoked_at set.
 */
export async function sendPush(admin: Admin, userIds: string[], msg: PushMessage, members?: Member[]): Promise<PushResult> {
  const token = process.env.EXPO_ACCESS_TOKEN;
  if (!token) return { skipped: "EXPO_ACCESS_TOKEN not set" };

  const all = members ?? (await loadMembers(admin));
  const allowed = new Set(all.filter((m) => userIds.includes(m.id) && mayReceive(m, msg)).map((m) => m.id));
  if (allowed.size === 0) return { recipients: 0, sent: 0, revoked: 0 };

  const { data: devices, error } = await admin
    .from("push_devices")
    .select("id, user_id, expo_token")
    .in("user_id", [...allowed])
    .is("revoked_at", null);
  if (error) throw new Error(error.message);
  const list = devices ?? [];
  const { title, body, data } = render(msg, await getForumSettings());

  let sent = 0;
  const dead: string[] = [];
  for (let i = 0; i < list.length; i += 100) {
    const batch = list.slice(i, i + 100);
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(batch.map((d) => ({ to: d.expo_token, title, body, data, sound: "default" }))),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Expo push ${res.status}`);
    const tickets = ((await res.json()) as { data?: { status: string; details?: { error?: string } }[] }).data ?? [];
    tickets.forEach((t, j) => {
      if (t.status === "ok") sent++;
      else if (t.details?.error === "DeviceNotRegistered") dead.push(batch[j].id);
    });
  }
  if (dead.length) await admin.from("push_devices").update({ revoked_at: new Date().toISOString() }).in("id", dead);
  return { recipients: allowed.size, sent, revoked: dead.length };
}

/** A meeting-date push to everyone who may see it. */
export async function pushToAll(admin: Admin, msg: PushMessage): Promise<PushResult> {
  const members = await loadMembers(admin);
  return sendPush(admin, members.map((m) => m.id), msg, members);
}
