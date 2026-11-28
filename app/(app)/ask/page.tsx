import { redirect } from "next/navigation";
import { getForumContext } from "@/app/_data/context";
import { getMeeting } from "@/app/_data/forum";
import { longDay, shortDay } from "@/app/_data/format";
import { ForumAsk } from "@/components/ForumAsk";
import { PageBanner } from "@/components/PageBanner";
import s from "./ask.module.css";

const FORUM_SUGGESTIONS = ["What did I commit to at the last forum?", "Summarise the newest agenda"];

// Ask AI about the forum. Questions about your own WHOOP data are asked on Biometrics.
export default async function AskPage({ searchParams }: { searchParams: Promise<{ about?: string; meeting?: string }> }) {
  const { about, meeting: meetingParam } = await searchParams;
  if (about === "data") redirect("/biometrics#ask");
  const { db, viewer } = await getForumContext();
  // "Ask about this forum" passes the meeting's date; only a meeting the member can see is used
  const m = meetingParam ? await getMeeting(db, viewer, meetingParam) : null;
  const meeting = m ? { id: m.id, label: `the ${shortDay(m.held_on)} ${m.title}` } : null;

  return (
    <>
    <PageBanner src="/banners/ask.webp" position="50% 55%">
      <header>
        <div className="eyebrow">AI · your forum assistant</div>
        <h1>Ask AI</h1>
        <p className="sub">
          An AI that has read the forums you attended{viewer.forum_joined_on ? `, from ${longDay(viewer.forum_joined_on)}` : ""}, and nothing else.
          Answers cite their agenda. Only you see your questions.
        </p>
      </header>
    </PageBanner>
    <main className="page">
      <section className={`zone-card ${s.card}`}>
        <ForumAsk meeting={meeting} suggestions={FORUM_SUGGESTIONS} />
      </section>
    </main>
    </>
  );
}
