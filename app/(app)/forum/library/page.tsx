import Link from "next/link";
import { getForumContext } from "@/app/_data/context";
import { listLibrary } from "@/app/_data/forum";

export default async function LibraryPage() {
  const { db, viewer } = await getForumContext();
  const docs = await listLibrary(db, viewer);
  return (
    <section className="zone-card">
      {docs.length === 0 ? (
        <p className="trend-empty">Nothing in the library yet. The Constitution and Resources are added soon.</p>
      ) : (
        <ul className="rows">
          {docs.map((d) => (
            <li key={d.slug}>
              <Link href={`/forum/library/${d.slug}`} className="row">
                <span className="row-main"><b>{d.title}</b></span>
                {d.audience === "founding" && <span className="tag founding">founding</span>}
                <span className="chev" aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
