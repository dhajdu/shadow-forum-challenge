import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStandings } from "@/lib/standings";
import { RaceBoard, type RaceRow } from "@/components/RaceBoard";
import { NavBar } from "@/components/NavBar";
import { dayOfContest, CONTEST_DAYS, PLACEMENT_PENALTIES } from "@/lib/contest";
import styles from "./race.module.css";

export const dynamic = "force-dynamic";
import { coachNameFor } from "@/lib/roster";
import type { GoalStatus } from "@/lib/database.types";
import { getSessionUser } from "@/lib/supabase/session";

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function RacePage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/");

  const today = new Date().toISOString().slice(0, 10);

  // business goals (public status, readable by all), standings, the previous weekly
  // snapshot and my last upload — independent reads, fetched together.
  // The rider's own goal is in the same list — no goal yet → onboarding.
  const [{ data: goals }, standings, { data: snap }, { data: lastUpload }] = await Promise.all([
    supabase.from("goals").select("user_id, title, current_status"),
    getStandings(supabase),
    supabase
      .from("standings_snapshots")
      .select("day, data")
      .lt("day", today)
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("uploads")
      .select("created_at, status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!(goals ?? []).some((g) => (g as { user_id: string }).user_id === user.id)) redirect("/welcome");

  type GoalRow = { user_id: string; title: string; current_status: GoalStatus };
  const goalByUser = new Map(
    ((goals ?? []) as GoalRow[]).map((g) => [g.user_id, { title: g.title, status: g.current_status }])
  );
  const rows: RaceRow[] = standings.map((s) => ({
    ...s,
    goal: goalByUser.get(s.user_id) ?? null,
    coach: coachNameFor(s.full_name),
  }));

  const pot = PLACEMENT_PENALTIES.reduce((a, b) => a + b, 0);
  const myIdx = standings.findIndex((s) => s.user_id === user.id);
  const me = myIdx >= 0 ? standings[myIdx] : null;
  const overdue = standings.filter((s) => s.stale).length;

  // biggest mover since the last snapshot (data is [{ user_id, rank, ... }])
  const prevRank = new Map(
    ((snap?.data ?? []) as { user_id: string; rank: number }[]).map((d) => [d.user_id, d.rank])
  );
  let move: { name: string; delta: number } | null = null;
  for (const [i, s] of standings.entries()) {
    const prev = prevRank.get(s.user_id);
    if (prev == null) continue;
    const delta = prev - (i + 1);
    if (delta !== 0 && (!move || Math.abs(delta) > Math.abs(move.delta))) move = { name: s.full_name, delta };
  }

  return (
    <main className="app">
      <NavBar active="race" />

      <div className="race-head">
        <div>
          <div className="eyebrow">Q4 2026 · <span className="live">● live</span></div>
          <h1>Race Into the Shadow</h1>
          <p className="sub">Highest average WHOOP score leads. Deepest into the shadow pays nothing.</p>
        </div>
      </div>

      <div className={styles.layout}>
        <RaceBoard rows={rows} />

        <aside className={styles.side}>
          <section className="card">
            <h3>You</h3>
            <div className={styles.youStats}>
              <div>
                <b>{me ? `#${myIdx + 1}` : "—"}</b>
                <span>place</span>
              </div>
              <div>
                <b>{me?.avg || "—"}</b>
                <span>avg</span>
              </div>
            </div>
            <p className="dim">
              Last upload:{" "}
              {lastUpload ? (
                <>
                  {fmtDay(lastUpload.created_at)}
                  {lastUpload.status === "error" && " (failed)"}
                </>
              ) : (
                "none yet"
              )}
            </p>
            <Link href="/me" className={`btn ${styles.btn}`}>
              Upload WHOOP
            </Link>
          </section>

          <div className={`kpis ${styles.kpis}`}>
            <div className="kpi"><b>{dayOfContest()}/{CONTEST_DAYS}</b><span>contest day</span></div>
            <div className="kpi k-kitty"><b>{pot}M</b><span>pot</span></div>
          </div>

          <section className="card">
            <h3>This week</h3>
            <p className={`dim ${styles.line}`}>
              {!snap
                ? "No weekly snapshot yet — movers show from the first one."
                : move
                  ? <>Biggest mover: <b className={styles.ink}>{move.name}</b> {move.delta > 0 ? "▲" : "▼"} {Math.abs(move.delta)} since {fmtDay(snap.day)}</>
                  : `No place changes since ${fmtDay(snap.day)}.`}
            </p>
            <p className={`dim ${styles.line}`}>
              {overdue === 0
                ? "Everyone's uploads are current."
                : `${overdue} rider${overdue === 1 ? "" : "s"} overdue on uploads.`}
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
