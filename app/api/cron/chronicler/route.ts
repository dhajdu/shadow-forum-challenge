import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { sendEmail } from "@/lib/notify";
import { buildReport } from "@/lib/report";

export const dynamic = "force-dynamic";

// The Chronicler — build the monthly report and email it to the group.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";

  const admin = createAdminClient();
  const report = await buildReport(admin);

  const monthLabel = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  const link = `${site}/report/${encodeURIComponent(monthLabel)}`;

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

  // recipients: all members with an email
  const { data: profs } = await admin.from("profiles").select("email");
  const recipients = ((profs ?? []) as { email: string | null }[])
    .map((p) => p.email)
    .filter((e): e is string => !!e);

  let sent = 0;
  if (!dry) {
    for (const to of recipients) {
      const res = await sendEmail({ to, subject: `The Shadow Forum — ${monthLabel} report`, html });
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
