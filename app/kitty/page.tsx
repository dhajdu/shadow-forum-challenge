import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { PenaltyKind } from "@/lib/database.types";

const KIND_LABEL: Record<PenaltyKind, string> = {
  placement: "Placement",
  missed_goal: "Missed goal",
  coach_share: "Coach share",
};

type Penalty = { user_id: string; kind: PenaltyKind; amount_m: number; reason: string | null };

export default async function KittyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: pen } = await supabase
    .from("penalties")
    .select("user_id, kind, amount_m, reason");
  const penalties = (pen ?? []) as Penalty[];

  const { data: profs } = await supabase.from("profiles").select("id, full_name");
  const nameById = new Map(
    ((profs ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name])
  );

  const byRider = new Map<string, number>();
  for (const p of penalties) byRider.set(p.user_id, (byRider.get(p.user_id) ?? 0) + p.amount_m);
  const total = penalties.reduce((a, b) => a + b.amount_m, 0);

  const riderTotals = Array.from(byRider.entries())
    .map(([id, amt]) => ({ name: nameById.get(id) ?? "Rider", amt }))
    .sort((a, b) => b.amt - a.amt);

  return (
    <main className="app">
      <div className="bar">
        <div className="brand">THE SHADOW FORUM</div>
        <nav className="nav">
          <Link href="/race">Race</Link>
          <Link href="/me">My Zone</Link>
        </nav>
        <div className="spacer" />
        <Link href="/profile" className="av">◧</Link>
      </div>

      <Link href="/race" className="back">← back to race</Link>

      <div className="race-head">
        <div>
          <div className="eyebrow">The kitty</div>
          <h1>{total}M in the pot</h1>
          <p className="sub">Provisional — recomputed by the Bookkeeper. Settles Dec 31.</p>
        </div>
      </div>

      <section className="card">
        <h3>Who owes what</h3>
        {riderTotals.length === 0 ? (
          <p className="dim">Nothing owed yet.</p>
        ) : (
          <table className="ladder">
            <thead>
              <tr><th>Rider</th><th className="r">Owes</th></tr>
            </thead>
            <tbody>
              {riderTotals.map((r) => (
                <tr key={r.name}><td>{r.name}</td><td className="r amt owe">{r.amt}M</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Ledger</h3>
        <table className="ladder">
          <thead>
            <tr><th>Rider</th><th>Reason</th><th className="r">Amount</th></tr>
          </thead>
          <tbody>
            {penalties.map((p, i) => (
              <tr key={i}>
                <td>{nameById.get(p.user_id) ?? "Rider"}</td>
                <td>{p.reason ?? KIND_LABEL[p.kind]}</td>
                <td className="r amt owe">{p.amount_m}M</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
