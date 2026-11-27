import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getForumContext } from "@/app/_data/context";
import { listSeasons } from "@/app/_data/forum";
import { PageBanner } from "@/components/PageBanner";
import { addGoal, deleteGoal, updateGoal } from "./actions";
import s from "./goals.module.css";

type Goal = { id: string; title: string; unit: string | null; target_value: number | null; current_value: number };

const pct = (g: Goal) => (g.target_value && g.target_value > 0 ? Math.max(0, Math.min(100, Math.round((g.current_value / g.target_value) * 100))) : null);
const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season: slug } = await searchParams;
  const { db, user, viewer, today } = await getForumContext();
  const seasons = await listSeasons(db, viewer); // newest first
  // default: the quarter that is running, else the next one, else the newest
  const running = seasons.find((x) => x.starts_on <= today && today <= x.ends_on);
  const upcoming = [...seasons].reverse().find((x) => x.starts_on > today);
  const season = seasons.find((x) => x.slug === slug) ?? upcoming ?? running ?? seasons[0] ?? null;

  let goals: Goal[] = [];
  if (season) {
    const { data } = await (db as unknown as SupabaseClient)
      .from("personal_goals")
      .select("id, title, unit, target_value, current_value")
      .eq("user_id", user.id)
      .eq("season_id", season.id)
      .order("created_at", { ascending: true });
    goals = (data ?? []) as Goal[];
  }
  const editable = season != null && season.ends_on >= today;

  return (
    <>
      <PageBanner src="/banners/goals.webp" position="50% 45%">
        <h1>Goals</h1>
      </PageBanner>
      <main className={`page ${s.page}`}>
        {seasons.length > 1 && (
          <nav className="seg subtabs" aria-label="Quarter">
            {seasons.map((x) => (
              <Link key={x.id} href={`/goals?season=${x.slug}`} className={`seg-btn ${x.id === season?.id ? "on" : ""}`}>
                {x.name}
              </Link>
            ))}
          </nav>
        )}

        {!season ? (
          <p className="trend-empty">No quarter is set up yet.</p>
        ) : (
          <>
            <header className={s.head}>
              <h2>{season.name}</h2>
              <p className="note-line">
                {goals.length === 0
                  ? editable
                    ? "No goals yet. Add as many as you like."
                    : "No goals were set this quarter."
                  : `${goals.length} goal${goals.length === 1 ? "" : "s"}`}
              </p>
            </header>

            <ul className={s.list}>
              {goals.map((g) => {
                const p = pct(g);
                return (
                  <li key={g.id} className={s.goal}>
                    <div className={s.main}>
                      <b className={s.title}>{g.title}</b>
                      <span className="note-line">
                        {n(g.current_value)}
                        {g.unit ? ` ${g.unit}` : ""}
                        {g.target_value != null ? ` of ${n(g.target_value)}${g.unit ? ` ${g.unit}` : ""}` : ""}
                      </span>
                      {p != null && (
                        <div className={s.bar} aria-hidden>
                          <i style={{ width: `${p}%` }} />
                        </div>
                      )}
                    </div>
                    <span className={s.pct}>{p != null ? `${p}%` : ""}</span>
                    {editable && (
                      <div className={s.edit}>
                        <form action={updateGoal} className={s.update}>
                          <input type="hidden" name="id" value={g.id} />
                          <input className="field" name="current_value" type="number" step="any" defaultValue={g.current_value} aria-label={`Progress on ${g.title}`} />
                          <button className="btn-ghost" type="submit">Update</button>
                        </form>
                        <form action={deleteGoal}>
                          <input type="hidden" name="id" value={g.id} />
                          <button className={s.del} type="submit" aria-label={`Delete ${g.title}`}>Delete</button>
                        </form>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {editable && (
              <form action={addGoal} className={s.add}>
                <input type="hidden" name="season_id" value={season.id} />
                <label className={s.wide}>
                  <span>New {season.name} goal</span>
                  <input className="field" name="title" placeholder="e.g. Close 3 enterprise deals" required maxLength={200} />
                </label>
                <label>
                  <span>Target</span>
                  <input className="field" name="target_value" type="number" step="any" placeholder="3" />
                </label>
                <label>
                  <span>Unit</span>
                  <input className="field" name="unit" placeholder="deals" maxLength={40} />
                </label>
                <button className="btn inline" type="submit">Add goal</button>
              </form>
            )}
          </>
        )}
      </main>
    </>
  );
}
