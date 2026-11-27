import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { getMeeting, getViewer } from "@/app/_data/forum";

// "Add to calendar": one forum as an .ics event. Same visibility as the agenda page.
export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const db = await createClient();
  const user = await getSessionUser(db);
  if (!user) return new NextResponse("Not found", { status: 404 });
  const m = /^(\d{4}-\d{2}-\d{2}|[0-9a-f-]{36})$/i.test(date) ? await getMeeting(db, await getViewer(db, user.id), date) : null;
  if (!m) return new NextResponse("Not found", { status: 404 });

  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = m.starts_at ? new Date(m.starts_at) : null;
  const end = start ? new Date(start.getTime() + 3 * 3_600_000) : null;
  const esc = (t: string) => t.replace(/[\;,]/g, (c) => `\\${c}`);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Shadow Forum//EN",
    "BEGIN:VEVENT",
    `UID:${m.id}@eoshadowforum.com`,
    `DTSTAMP:${stamp(new Date())}`,
    ...(start && end
      ? [`DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`]
      : [`DTSTART;VALUE=DATE:${date.replace(/-/g, "")}`]),
    `SUMMARY:${esc(`Shadow Forum · ${m.title}`)}`,
    ...(m.place ? [`LOCATION:${esc(m.place)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="shadow-forum-${date}.ics"`,
    },
  });
}
