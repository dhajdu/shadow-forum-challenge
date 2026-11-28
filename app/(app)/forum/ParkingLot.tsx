import type { ParkingGroup } from "@/app/_data/recap";
import s from "./recap.module.css";

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

/** The forum's Parking Lot: topics members asked to bring back, newest forum first. */
export function ParkingLot({ groups, compact = false }: { groups: ParkingGroup[]; compact?: boolean }) {
  if (groups.length === 0) return <p className="note-line">No topics waiting. Every one got its time.</p>;
  const sorted = [...groups].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const shown = compact ? sorted.slice(0, 2) : sorted;
  return (
    <div className={s.parking}>
      {shown.map((g, gi) => (
        <section key={gi} className={s.pgroup}>
          <h3 className={s.pdate}>{g.date ? `Raised ${fmt(g.date)}` : g.label}</h3>
          <ul className={s.topics}>
            {g.topics.map((t, i) => (
              <li key={i} className={`${s.topic} ${t.nextForum ? s.next : ""}`}>
                <span className={s.who} aria-hidden>{t.who ? initials(t.who) : "·"}</span>
                <div className={s.topicBody}>
                  <div className={s.topicHead}>
                    {t.who && <b>{t.who}</b>}
                    {t.nextForum && <span className={s.badge}>Next forum</span>}
                  </div>
                  <p>{t.topic}</p>
                  {!compact && t.details.length > 0 && (
                    <ul className={s.details}>
                      {t.details.map((d, j) => <li key={j}>{d}</li>)}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
