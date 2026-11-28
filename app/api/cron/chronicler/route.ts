import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { sendEmail } from "@/lib/notify";
import { buildReport } from "@/lib/report";
import { hasContest, seasonForDay } from "@/lib/contest";
import { groupScope, loadAccess, seasonAudience } from "@/lib/access";
import { getForumSettings } from "@/lib/forum-settings";

export const dynamic = "force-dynamic";

// The Chronicler — build the monthly report and email it to the group.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";

  const admin = createAdminClient();

  // Recipients: only active members who can see the report's season. Members who
  // joined after it started are left out rather than the report being trimmed.
  // The report covers the month just ended, so the season that month's last day belonged to.
  const { members, seasons } = await loadAccess(admin);
  const now = new Date();
  const lastOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).toISOString().slice(0, 10);
  const season = seasonForDay(seasons, lastOfPrevMonth);
  const audience = seasonAudience(members, season);
  // Group output: everything in it must be visible to the latest-joined recipient.
  if (!groupScope(audience).canSeeSeason(season)) {
    return NextResponse.json({ ok: true, dry, skipped: "no recipient can see the season", recipients: 0, sent: 0 });
  }
  if (!season || !hasContest(season)) {
    return NextResponse.json({ ok: true, dry, skipped: "no contest this season", recipients: 0, sent: 0 });
  }
  const report = await buildReport(admin, season);

  const monthLabel = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  const link = `${site}/contest/report/${new Date().toISOString().slice(0, 7)}`;

  const rowsHtml = report.standings
    .map(
      (r) =>
        `<tr><td>${r.rank}. ${r.name}</td><td>${r.avg || "—"}</td><td>${
          r.owes === 0 ? "0" : r.owes + "M"
        }</td></tr>`
    )
    .join("");
  const html = `
    <h2>Race Into the Shadow — ${monthLabel}</h2>
    <p>Leader: <b>${report.standings[0]?.name ?? "—"}</b>.
       Biggest mover: ${report.topMover?.name ?? "—"}.</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <tr><th>Rider</th><th>Avg</th><th>Owes</th></tr>${rowsHtml}
    </table>
    <p><a href="${link}">View the full report →</a></p>`;

  const recipients = audience.map((m) => m.email).filter((e): e is string => !!e);

  let sent = 0;
  if (!dry) {
    for (const to of recipients) {
      const res = await sendEmail({ to, subject: `${(await getForumSettings()).name} — ${monthLabel} report`, html });
      if (res.ok) sent++;
    }
  }

  return NextResponse.json({
    ok: true,
    dry,
    month: monthLabel,
    link,
    riders: report.standings.length,
    recipients: recipients.length,
    sent,
  });
}
