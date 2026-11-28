// The Analyst: once a week, Claude compares each active member's WHOOP journal
// answers with their daily scores and writes a short, personal analysis. Each
// member's data goes to the model on its own and the result is stored owner-only
// in journal_analyses (RLS: the member reads their own, while active).
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { selectAll } from "@/lib/supabase/selectAll";
import { isActive, loadMembers } from "@/lib/access";
import { getForumSettings } from "@/lib/forum-settings";

type Admin = SupabaseClient<Database>;

export const ANALYST_MODEL = "claude-opus-5-5";
const WINDOW_DAYS = 90;

export type JournalAnalysis = {
  headline: string;
  insights: { title: string; detail: string; effect: "helps" | "hurts" | "mixed" }[];
  suggestion: string;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "insights", "suggestion"],
  properties: {
    headline: { type: "string", description: "One sentence: the single most important pattern for this member." },
    insights: {
      type: "array",
      description: "3 to 5 insights, strongest first.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "effect"],
        properties: {
          title: { type: "string", description: "Short label, e.g. 'Alcohol costs you ~10 recovery points'" },
          detail: { type: "string", description: "1-2 sentences with the numbers behind it." },
          effect: { type: "string", enum: ["helps", "hurts", "mixed"] },
        },
      },
    },
    suggestion: { type: "string", description: "One concrete thing to try this week." },
  },
};

const system = (forumName: string) => [
  `You analyse one member's WHOOP data for ${forumName}, a private fitness-accountability contest.`,
  "Each line is one day: race score (0-100, the average of recovery %, sleep performance % and strain as % of 21), the components, HRV and resting HR, then that day's journal answers (yes / no).",
  "Compare journal behaviours with the scores. Journal answers describe the day they're logged on, so look mainly at their effect on the NEXT day's recovery, sleep and score.",
  "Only report patterns the data supports: quote the numbers (averages with vs without, and how many days), and say when a sample is small. Don't give medical advice.",
  "Write directly to the member ('you'), plainly and briefly.",
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

async function analyseMember(client: Anthropic, admin: Admin, userId: string): Promise<JournalAnalysis | null> {
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

  const response = await client.messages.create({
    model: ANALYST_MODEL,
    max_tokens: 16000,
    output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
    system: system((await getForumSettings()).name),
    messages: [{ role: "user", content: `Last ${WINDOW_DAYS} days, oldest first:\n${dailyLines(days, journal)}` }],
  });
  if (response.stop_reason !== "end_turn") return null; // refusal or cut off
  const text = response.content.find((b) => b.type === "text");
  return text ? (JSON.parse(text.text) as JournalAnalysis) : null;
}

/** Analyse every active member in parallel and store this week's result. */
export async function runAnalyst(admin: Admin) {
  if (!process.env.ANTHROPIC_API_KEY) return { skipped: "ANTHROPIC_API_KEY not set" };
  const client = new Anthropic();
  const weekOf = new Date().toISOString().slice(0, 10);
  const members = (await loadMembers(admin)).filter((m) => isActive(m));

  const results = await Promise.all(
    members.map(async (m) => {
      try {
        const a = await analyseMember(client, admin, m.id);
        if (!a) return { member: m.full_name, status: "not enough data" };
        const { error } = await admin.from("journal_analyses").upsert(
          { user_id: m.id, week_of: weekOf, headline: a.headline, insights: a.insights, suggestion: a.suggestion, model: ANALYST_MODEL },
          { onConflict: "user_id,week_of" }
        );
        return { member: m.full_name, status: error ? `error: ${error.message}` : "ok" };
      } catch (e) {
        return { member: m.full_name, status: `error: ${(e as Error).message}` };
      }
    })
  );
  return { weekOf, results };
}
