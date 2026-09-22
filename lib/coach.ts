import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { coachNameFor, normalizeName } from "@/lib/roster";

/**
 * Set each goal's coach_id from the roster: coach = the profile whose name is
 * the goal owner's assigned coach. Safe to run repeatedly; backfills coaches as
 * more participants join.
 */
export async function reconcileCoaches(supabase: SupabaseClient<Database>) {
  const { data: goals } = await supabase.from("goals").select("id, user_id, coach_id");
  const { data: profs } = await supabase.from("profiles").select("id, full_name");

  const idByName = new Map<string, string>();
  const nameById = new Map<string, string>();
  for (const p of (profs ?? []) as { id: string; full_name: string }[]) {
    idByName.set(normalizeName(p.full_name), p.id);
    nameById.set(p.id, p.full_name);
  }

  for (const g of (goals ?? []) as { id: string; user_id: string; coach_id: string | null }[]) {
    const ownerName = nameById.get(g.user_id);
    if (!ownerName) continue;
    const coachName = coachNameFor(ownerName);
    const coachId = coachName ? idByName.get(normalizeName(coachName)) ?? null : null;
    if (coachId && coachId !== g.coach_id) {
      await supabase.from("goals").update({ coach_id: coachId }).eq("id", g.id);
    }
  }
}
