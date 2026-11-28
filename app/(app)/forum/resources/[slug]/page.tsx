import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getForumContext } from "@/app/_data/context";
import { getLibraryDoc } from "@/app/_data/forum";
import { longDay } from "@/app/_data/format";
import { Markdown } from "@/components/Markdown";
import s from "../../forum.module.css";

export default async function LibraryDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "resources") redirect("/forum/resources"); // the toolkit is the Resources tab itself
  if (slug === "expense-sheet") redirect("/kitty"); // the Expense Sheet became the Kitty
  const { db, viewer } = await getForumContext();
  const doc = await getLibraryDoc(db, viewer, slug);
  if (!doc) notFound();
  return (
    <>
      <Link href="/forum/resources" className="back">← Resources</Link>
      <section className={`zone-card ${s.below}`}>
        <header className={s.detailHead}>
          <div className="eyebrow">Updated {longDay(doc.updated_at.slice(0, 10))}</div>
          <h2>{doc.title}</h2>
        </header>
        <Markdown text={doc.body_md} title={doc.title} />
      </section>
    </>
  );
}
