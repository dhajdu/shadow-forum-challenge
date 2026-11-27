import Link from "next/link";
import { getForumContext } from "@/app/_data/context";
import { getMeeting } from "@/app/_data/forum";
import { longDay, shortDay } from "@/app/_data/format";
import { Assistant } from "@/components/Assistant";
import { ForumAsk } from "@/components/ForumAsk";
import { PageBanner } from "@/components/PageBanner";
import s from "./ask.module.css";

const FORUM_SUGGESTIONS = ["What did I commit to at the last forum?", "Summarise the newest agenda"];

export default async function AskPage({ searchParams }: { searchParams: Promise<{ about?: string; meeting?: string }> }) {
  const { about, meeting: meetingParam } = await searchParams;
  const { db, viewer } = await getForumContext();
  const data = about === "data";
  // "Ask about this forum" passes the meeting's date; only a meeting the member can see is used
  const m = !data && meetingParam ? await getMeeting(db, viewer, meetingParam) : null;
  const meeting = m ? { id: m.id, label: `the ${shortDay(m.held_on)} ${m.title}` } : null;

  return (
    <>
    <PageBanner src="/banners/ask.webp" position="50% 55%">
      <header>
        <div className="eyebrow">The forum assistant</div>
        <h1>Ask</h1>
        <p className="sub">
          {data
            ? "Ask about your WHOOP data and your contest. Only you see your questions and answers."
            : `It knows the forums you attended${viewer.forum_joined_on ? `, from ${longDay(viewer.forum_joined_on)}` : ""}, and nothing else. Answers cite their agenda.`}
        </p>
      </header>
    </PageBanner>
    <main className="page">
      <nav className="seg subtabs" aria-label="Ask about">
        <Link href="/ask" className={`seg-btn ${data ? "" : "on"}`}>Forum</Link>
        <Link href="/ask?about=data" className={`seg-btn ${data ? "on" : ""}`}>My WHOOP data</Link>
      </nav>
      <section className={`zone-card ${s.card}`}>
        {data ? <Assistant /> : <ForumAsk meeting={meeting} suggestions={FORUM_SUGGESTIONS} />}
      </section>
    </main>
    </>
  );
}
