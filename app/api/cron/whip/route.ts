import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron";
import { sendEmail } from "@/lib/notify";
import { CONTEST_START, CONTEST_END } from "@/lib/contest";

export const dynamic = "force-dynamic";

const STALE_DAYS = 2;

// The Whip — nudge riders whose WHOOP data has gone stale.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";

  const admin = createAdminClient();
  const { data: profs } = await admin.from("profiles").select("id, full_name, email");
  const { data: rows } = await admin.from("whoop_days").select("user_id, day");

  const latest = new Map<string, string>();
  for (const r of (rows ?? []) as { user_id: string; day: string }[]) {
    const cur = latest.get(r.user_id);
    if (!cur || r.day > cur) latest.set(r.user_id, r.day);
  }

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const stale = ((profs ?? []) as { id: string; full_name: string; email: string | null }[])
    .filter((p) => {
      const l = latest.get(p.id);
      return !l || l < cutoffStr;
    })
    .map((p) => ({ id: p.id, name: p.full_name, email: p.email, lastData: latest.get(p.id) ?? null }));

  // Only actually email during the contest window.
  const contestActive = now >= CONTEST_START && now <= CONTEST_END;
  const nudged: string[] = [];

  if (!dry && contestActive) {
    for (const s of stale) {
      if (!s.email) continue;
      const res = await sendEmail({
        to: s.email,
        subject: "The Whip: your WHOOP data has gone quiet",
        html: `<p>${s.name || "Rider"}, your data is stale${
          s.lastData ? ` (last seen ${s.lastData})` : ""
        }. Missing days count as your lowest score — upload before you slide down the shadow. 🏃</p>`,
      });
      if (res.ok) nudged.push(s.id);
    }
  }

  return NextResponse.json({
    ok: true,
    contestActive,
    dry,
    staleCount: stale.length,
    stale: stale.map((s) => ({ name: s.name, lastData: s.lastData })),
    nudged: nudged.length,
  });
}
