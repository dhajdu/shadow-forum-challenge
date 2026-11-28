import Link from "next/link";
import { notFound } from "next/navigation";
import { getForumContext } from "@/app/_data/context";
import { getConstitution } from "@/app/_data/constitution";
import { AmendForm } from "./AmendForm";

// Admin: amend the Constitution. Publishing makes a new version; every member signs it again.
export default async function AmendPage() {
  const { db, viewer } = await getForumContext();
  if (!viewer.is_admin) notFound();
  const { current } = await getConstitution(db);
  return (
    <main className="page">
      <Link href="/me/members" className="back">← Members and access</Link>
      <header className="page-head">
        <div className="eyebrow">Admin</div>
        <h1>Amend the Constitution</h1>
        <p className="sub">
          {current ? `Now in force: version ${current.version}.` : "No version published yet."} Publishing a change makes a new version, and every member is asked
          to read what changed and sign again.
        </p>
      </header>
      <section className="zone-card">
        <AmendForm body={current?.body_md ?? ""} next={(current?.version ?? 0) + 1} />
      </section>
    </main>
  );
}
