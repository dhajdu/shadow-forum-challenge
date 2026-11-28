import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getForumContext } from "@/app/_data/context";
import { listLibrary } from "@/app/_data/forum";
import s from "./resources.module.css";

// Resources: the forum's toolkit, following a forum month. Our own documents first, then the
// worksheets members use before and in the room (private files, active members only), then EO links.
// Mirrors the forum's imported "Resources" page.

type Tool = { path: string; title: string; when: string; what: string; pages?: number };

const BEFORE: Tool[] = [
  {
    path: "reflections-sheet.pdf",
    title: "5% Reflection worksheet",
    when: "Every forum",
    what: "Your monthly update. Your strongest feelings in work, family and personal life, what caused them, why they matter, the next 30 to 60 days, and topics for the Deep Dive parking lot.",
    pages: 1,
  },
  {
    path: "deep-dive-worksheet.pdf",
    title: "Deep Dive: presenter's worksheet",
    when: "When you present",
    what: "Headline, context and the questions underneath. Fill it in before your coaching session; update it after.",
    pages: 4,
  },
];

const ROOM: Tool[] = [
  {
    path: "communication-starters.pdf",
    title: "Communication starters",
    when: "Opening the meeting",
    what: "Icebreakers that bring everyone into the room and set the tone for deeper 5% Reflections and Deep Dives.",
    pages: 6,
  },
  {
    path: "lifeline.pdf",
    title: "Lifeline",
    when: "Getting to know each other",
    what: "Plot the highs, the lows and the turning points of your life, from the day you were born until today, then walk the forum through it.",
    pages: 1,
  },
];

const LINKS = [
  { href: "https://member.eonetwork.org/member/forum/meeting-resources", title: "One EO Hub: forum meeting resources", what: "The full EO forum library. Start here." },
  { href: "https://vimeo.com/1041218191/5fb68ed24d?fl=pl&fe=sh", title: "Forum Mindset Series, Brian Brault", what: "Video series on how a forum works at its best." },
  { href: "https://chatgpt.com/g/g-68cfcbdaa600819183d58e994f289bbd-eo-forum-updates", title: "EO Forum Updates (ChatGPT)", what: "A custom GPT that helps you shape your monthly update." },
];

const HIDDEN = new Set(["resources", "expense-sheet"]); // the page itself; the Expense Sheet is now the Kitty

export default async function ResourcesPage() {
  const { db, viewer } = await getForumContext();
  const docs = (await listLibrary(db, viewer)).filter((d) => !HIDDEN.has(d.slug));
  const paths = [...BEFORE, ...ROOM].map((t) => t.path).concat("johari-window.webp");
  const { data: signed } = await (db as unknown as SupabaseClient).storage.from("forum-resources").createSignedUrls(paths, 3600);
  const url = (p: string) => signed?.find((x) => x.path === p && !x.error)?.signedUrl ?? null;
  const johari = url("johari-window.webp");

  const tools = (list: Tool[]) => (
    <ul className={s.tools}>
      {list.map((t) => {
        const href = url(t.path);
        return (
          <li key={t.path} className={s.tool}>
            <span className={s.when}>{t.when}</span>
            <b>{t.title}</b>
            <p>{t.what}</p>
            {href ? (
              <a href={href} target="_blank" rel="noreferrer" className={s.open}>
                Open PDF{t.pages ? ` · ${t.pages} page${t.pages === 1 ? "" : "s"}` : ""} →
              </a>
            ) : (
              <span className="note-line">File not available</span>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={s.page}>
      <p className={s.lede}>The tools we use in the forum, in the order a forum month uses them. The full EO library lives on the One EO Hub.</p>

      <section className={s.block}>
        <h2 className={s.label}>Our forum</h2>
        <ul className="rows">
          {docs.map((d) => (
            <li key={d.slug}>
              <Link href={`/forum/resources/${d.slug}`} className="row">
                <span className="row-main"><b>{d.title}</b></span>
                {d.audience === "founding" && <span className="tag founding">founding</span>}
                <span className="chev" aria-hidden>→</span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/kitty" className="row">
              <span className="row-main"><b>Kitty</b><small>The forum&apos;s money: balance, dues and the ledger</small></span>
              <span className="chev" aria-hidden>→</span>
            </Link>
          </li>
        </ul>
      </section>

      <section className={s.block}>
        <h2 className={s.label}>Before the forum</h2>
        {tools(BEFORE)}
      </section>

      <section className={s.block}>
        <h2 className={s.label}>In the room</h2>
        {tools(ROOM)}
        <figure className={s.johari}>
          {johari && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
            <img src={johari} alt="Johari Window: open, blind, hidden and unknown, with sharing and asking widening the open area" />
          )}
          <figcaption>
            <b>Johari Window: why we share</b>
            Disclosure moves what is hidden into the open. Asking the forum moves your blind spots into the open. The bigger the open window, the more
            the forum can help.
          </figcaption>
        </figure>
      </section>

      <section className={s.block}>
        <h2 className={s.label}>Go deeper</h2>
        <ul className="rows">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} target="_blank" rel="noreferrer" className="row">
                <span className="row-main"><b>{l.title}</b><small>{l.what}</small></span>
                <span className="chev" aria-hidden>↗</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
