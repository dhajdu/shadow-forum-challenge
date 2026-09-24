import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ChatMsg = { role: "user" | "assistant"; content: string };

type Day = {
  day: string;
  score: number | null;
  recovery: number | null;
  strain: number | null;
  resting_hr: number | null;
  hrv: number | null;
};

function stats(vals: number[]) {
  if (vals.length === 0) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return {
    avg: Math.round(avg * 10) / 10,
    min: Math.min(...vals),
    max: Math.max(...vals),
    latest: vals[vals.length - 1],
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Assistant not configured." }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { messages?: ChatMsg[] };
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "No question." }, { status: 400 });
  }

  // The rider's OWN WHOOP data only.
  const { data: dayRows } = await supabase
    .from("whoop_days")
    .select("day, score, recovery, strain, resting_hr, hrv")
    .eq("user_id", user.id)
    .order("day", { ascending: true });
  const days = (dayRows ?? []) as Day[];

  const pick = (k: keyof Day) => days.map((d) => d[k]).filter((v): v is number => v != null);
  const summary = {
    days: days.length,
    range: days.length ? `${days[0].day} → ${days[days.length - 1].day}` : "none",
    score: stats(pick("score")),
    recovery: stats(pick("recovery")),
    strain: stats(pick("strain")),
    resting_hr: stats(pick("resting_hr")),
    hrv: stats(pick("hrv")),
  };
  const recent = days
    .slice(-45)
    .map((d) => `${d.day}: score=${d.score ?? "-"} rec=${d.recovery ?? "-"} strain=${d.strain ?? "-"} rhr=${d.resting_hr ?? "-"} hrv=${d.hrv ?? "-"}`)
    .join("\n");

  // The rider's OWN WHOOP journal answers — per-question yes rate + recent days.
  const { data: jRows } = await supabase
    .from("whoop_journal")
    .select("day, question, answered_yes, notes")
    .eq("user_id", user.id)
    .order("day", { ascending: true });
  const journal = (jRows ?? []) as { day: string; question: string; answered_yes: boolean | null; notes: string | null }[];

  const perQ = new Map<string, { yes: number; n: number }>();
  const byDay = new Map<string, { yes: string[]; no: string[]; notes: string[] }>();
  for (const j of journal) {
    if (j.answered_yes != null) {
      const q = perQ.get(j.question) ?? { yes: 0, n: 0 };
      q.n += 1;
      if (j.answered_yes) q.yes += 1;
      perQ.set(j.question, q);
    }
    const d = byDay.get(j.day) ?? { yes: [], no: [], notes: [] };
    if (j.answered_yes === true) d.yes.push(j.question);
    else if (j.answered_yes === false) d.no.push(j.question);
    if (j.notes) d.notes.push(`${j.question} ${j.notes}`);
    byDay.set(j.day, d);
  }
  const journalSummary = Array.from(perQ, ([q, v]) => `- ${q} yes ${v.yes}/${v.n} days`).join("\n");
  const journalRecent = Array.from(byDay)
    .slice(-45)
    .map(
      ([day, d]) =>
        `${day}: yes=[${d.yes.join("; ")}] no=[${d.no.join("; ")}]${d.notes.length ? ` notes=[${d.notes.join("; ")}]` : ""}`
    )
    .join("\n");

  const system = [
    "You are the WHOOP data analyst inside The Shadow Forum, a private fitness-accountability app.",
    "You are helping ONE rider understand THEIR OWN WHOOP data. You only ever have access to this rider's data — never reference or compare to anyone else.",
    "Give clear analysis, insights, and practical recommendations. Be concise and specific, use the numbers, and point out trends.",
    "Reply in plain text — no markdown tables, no ## headers, no ** bold. Use short paragraphs and simple '- ' bullets. Keep it tight.",
    "You are not a doctor; add a brief caution only if the user asks about symptoms or medical concerns.",
    days.length === 0
      ? "This rider has NOT uploaded any WHOOP data yet — tell them to upload their WHOOP export in My Zone first."
      : `Rider's WHOOP summary (metrics: score=recovery-based 0-100, recovery %, day strain 0-21, resting HR bpm, HRV ms):\n${JSON.stringify(summary)}\n\nMost recent days:\n${recent}`,
    journal.length === 0
      ? "This rider has no WHOOP journal entries uploaded."
      : `Rider's WHOOP journal (daily yes/no behaviours they logged; the journal day matches the metrics day). Use it to link behaviours to recovery, HRV, sleep and strain — e.g. compare metrics on days with vs without alcohol or late eating.\nYes rate per question:\n${journalSummary}\n\nMost recent journal days:\n${journalRecent}`,
  ].join("\n\n");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 900,
      system,
      messages,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return NextResponse.json({ error: `Assistant error: ${resp.status}`, detail: text.slice(0, 200) }, { status: 502 });
  }
  const data = (await resp.json()) as { content?: { type: string; text?: string }[] };
  const reply = (data.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n")
    .trim();

  return NextResponse.json({ reply: reply || "…" });
}
