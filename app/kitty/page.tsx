import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";
import { getRaceStandings } from "@/lib/standings";
import { placementPenalty } from "@/lib/contest";

export const dynamic = "force-dynamic";

export default async function KittyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Who owes what comes from the WHOOP race only (contest standings) — business
  // goals aren't realized until year end, so they don't count here yet.
  const { contest } = await getRaceStandings(supabase);
  const riderTotals = contest.map((s, i) => ({ id: s.user_id, name: s.full_name, place: i + 1, amt: placementPenalty(i) }));
  const total = riderTotals.reduce((a, r) => a + r.amt, 0);

  return (
    <main className="app">
      <NavBar active="kitty" />

      <Link href="/race" className="back">← back to race</Link>

      <div className="race-head">
        <div>
          <div className="eyebrow">The kitty</div>
          <h1>{total}M in the pot</h1>
          <p className="sub">
            Live — based on current WHOOP race position. Nothing is charged until the contest ends.
          </p>
        </div>
      </div>

      <section className="card">
        <h3>Who owes what</h3>
        {riderTotals.length === 0 ? (
          <p className="dim">Nothing owed yet.</p>
        ) : (
          <table className="ladder">
            <thead>
              <tr><th>Place</th><th>Rider</th><th className="r">Owes</th></tr>
            </thead>
            <tbody>
              {riderTotals.map((r) => (
                <tr key={r.id}>
                  <td>{r.place}</td>
                  <td>{r.name}</td>
                  <td className={`r amt ${r.amt === 0 ? "free" : "owe"}`}>{r.amt === 0 ? "0" : `${r.amt}M`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
