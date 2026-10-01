// The Analyst — once a week, Claude compares each rider's WHOOP journal answers
// with their daily scores and writes a short, personal analysis.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { selectAll } from "@/lib/supabase/selectAll";

type Admin = SupabaseClient<Database>;

export const ANALYST_MODEL = "claude-opus-5-5";
const WINDOW_DAYS = 90;

const Analysis = z.object({
  headline: z.string().describe("One sentence: the single most important pattern for this rider."),
  insights: z
    .array(
      z.object({
        title: z.string().describe("Short label, e.g. 'Alcohol costs you ~10 recovery points'"),
        detail: z.string().describe("1–2 sentences with the numbers behind it."),
        effect: z.enum(["helps", "hurts", "mixed"]),
      })
    )
    .describe("3 to 5 insights, strongest first."),
  suggestion: z.string().describe("One concrete thing to try this week."),
});
export type JournalAnalysis = z.infer<typeof Analysis>;

const SYSTEM = [
  "You analyse one rider's WHOOP data for The Shadow Forum, a private fitness-accountability contest.",
  "Each line is one day: race score (0-100, the average of recovery %, sleep performance % and strain as % of 21), the components, HRV and resting HR, then that day's journal answers (yes / no).",
  "Compare journal behaviours with the scores. Journal answers describe the day they're logged on, so look mainly at their effect on the NEXT day's recovery, sleep and score.",
  "Only report patterns the data supports: quote the numbers (averages with vs without, and how many days), and say when a sample is small. Don't give medical advice.",
  "Write directly to the rider ('you'), plainly and briefly.",
].join("\n");

type Day = { day: string; score: number | null; recovery: number | null; sleep: number | null; strain: number | null; hrv: number | null; resting_hr: number | null };
type Journal = { day: string; question: string; answered_yes: boolean | null };

const since = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

/** One compact line per day, e.g. "2026-09-24 score 50.3 rec 52 sleep 79 strain 4.2 hrv 41 rhr 58 | yes: … | no: …". */
function dailyLines(days: Day[], journal: Journal[]): string {
  const byDay = new Map<string, { yes: string[]; no: string[] }>();
  for (const j of journal) {
    if (j.answered_yes == null) continue;
    const e = byDay.get(j.day) ?? { yes: [], no: [] };
    (j.answered_yes ? e.yes : e.no).push(j.question);
    byDay.set(j.day, e);
  }
  const v = (x: number | null) => (x == null ? "-" : String(x));
  return days
    .map((d) => {
      const j = byDay.get(d.day);
      const journalPart = j ? ` | yes: ${j.yes.join("; ") || "-"} | no: ${j.no.join("; ") || "-"}` : "";
      return `${d.day} score ${v(d.score)} rec ${v(d.recovery)} sleep ${v(d.sleep)} strain ${v(d.strain)} hrv ${v(d.hrv)} rhr ${v(d.resting_hr)}${journalPart}`;
    })
    .join("\n");
}

async function analyseRider(client: Anthropic, admin: Admin, userId: string): Promise<JournalAnalysis | null> {
  const from = since(WINDOW_DAYS);
  const [days, journal] = await Promise.all([
    selectAll<Day>((a, b) =>
      admin.from("whoop_days").select("day, score, recovery, sleep, strain, hrv, resting_hr").eq("user_id", userId).gte("day", from).order("day").range(a, b)
    ),
    selectAll<Journal>((a, b) =>
      admin.from("whoop_journal").select("day, question, answered_yes").eq("user_id", userId).gte("day", from).order("day").order("question").range(a, b)
    ),
  ]);
  if (days.length < 7 || journal.length === 0) return null; // not enough to say anything

  const response = await client.messages.parse({
    model: ANALYST_MODEL,
    max_tokens: 16000,
    output_config: { effort: "high", format: zodOutputFormat(Analysis) },
    system: SYSTEM,
    messages: [{ role: "user", content: `Last ${WINDOW_DAYS} days, oldest first:\n${dailyLines(days, journal)}` }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  return response.parsed_output;
}

/** Analyse every rider in parallel and store this week's result. */
export async function runAnalyst(admin: Admin) {
  if (!process.env.ANTHROPIC_API_KEY) return { skipped: "ANTHROPIC_API_KEY not set" };
  const client = new Anthropic();
  const weekOf = new Date().toISOString().slice(0, 10);
  const { data: profs } = await admin.from("profiles").select("id, full_name");

  const results = await Promise.all(
    ((profs ?? []) as { id: string; full_name: string }[]).map(async (p) => {
      try {
        const a = await analyseRider(client, admin, p.id);
        if (!a) return { rider: p.full_name, status: "not enough data" };
        const { error } = await admin.from("journal_analyses").upsert(
          { user_id: p.id, week_of: weekOf, headline: a.headline, insights: a.insights, suggestion: a.suggestion, model: ANALYST_MODEL },
          { onConflict: "user_id,week_of" }
        );
        return { rider: p.full_name, status: error ? `error: ${error.message}` : "ok" };
      } catch (e) {
        return { rider: p.full_name, status: `error: ${(e as Error).message}` };
      }
    })
  );
  return { weekOf, results };
}
