import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { coachIdFor } from "@/lib/roster";
import { getForumSettings } from "@/lib/forum-settings";

/**
 * Set each goal's coach_id from the roster (rider id → coach id, written only
 * by admins). Never by name: members edit their own names. Safe to run
 * repeatedly; backfills coaches as more participants join.
 */
export async function reconcileCoaches(supabase: SupabaseClient<Database>) {
  const { coaches } = await getForumSettings();
  const { data: goals } = await supabase.from("goals").select("id, user_id, coach_id");
  const { data: profs } = await supabase.from("profiles").select("id");
  const exists = new Set((profs ?? []).map((p) => p.id));

  for (const g of (goals ?? []) as { id: string; user_id: string; coach_id: string | null }[]) {
    const coachId = coachIdFor(g.user_id, coaches);
    if (coachId && exists.has(coachId) && coachId !== g.coach_id) {
      await supabase.from("goals").update({ coach_id: coachId }).eq("id", g.id);
    }
  }
}
