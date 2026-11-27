import { getForumContext } from "@/app/_data/context";
import { listMeetings } from "@/app/_data/forum";
import { listGallery, type GalleryPhoto } from "@/app/_data/gallery";
import { longDay, todayVN } from "@/app/_data/format";
import { GalleryGrid } from "./GalleryGrid";
import { GalleryUpload } from "./GalleryUpload";
import { PageBanner } from "@/components/PageBanner";
import s from "./gallery.module.css";

type Group = { key: string; title: string; sub: string; photos: GalleryPhoto[] };

const monthTitle = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function GalleryPage() {
  const { db, viewer } = await getForumContext();
  const [photos, meetings] = await Promise.all([listGallery(db), listMeetings(db, viewer)]);
  const byId = new Map(meetings.map((m) => [m.id, m]));

  // one group per forum, else per month
  const groups: Group[] = [];
  const index = new Map<string, Group>();
  for (const p of photos) {
    const m = p.meeting_id ? byId.get(p.meeting_id) : undefined;
    const key = m ? m.id : p.taken_on.slice(0, 7);
    let g = index.get(key);
    if (!g) {
      g = m
        ? { key, title: m.title, sub: longDay(m.held_on), photos: [] }
        : { key, title: monthTitle(p.taken_on), sub: "", photos: [] };
      index.set(key, g);
      groups.push(g);
    }
    g.photos.push(p);
  }

  const forums = meetings
    .filter((m) => m.held_on <= todayVN())
    .map((m) => ({ id: m.id, label: `${longDay(m.held_on)} · ${m.title}`, date: m.held_on }));

  return (
    <>
    <PageBanner src="/banners/front.webp" position="50% 35%">
      <h1>Gallery</h1>
    </PageBanner>
    <main className={`page ${s.wrap}`}>
      <GalleryUpload forums={forums} today={todayVN()} />
      {groups.length === 0 ? (
        <p className="trend-empty">No photos yet. Add the first ones above.</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className={s.group}>
            <header className={s.groupHead}>
              <h2>{g.title}</h2>
              <span>
                {g.sub ? `${g.sub} · ` : ""}
                {g.photos.length} photo{g.photos.length === 1 ? "" : "s"}
              </span>
            </header>
            <GalleryGrid photos={g.photos} />
          </section>
        ))
      )}
    </main>
    </>
  );
}
