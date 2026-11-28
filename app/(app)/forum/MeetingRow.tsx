import Link from "next/link";
import type { Meeting } from "@/app/_data/forum";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MeetingRow({ m }: { m: Meeting }) {
  const meta = [
    m.theme ?? (m.status === "planned" ? "Coming" : m.has_agenda ? "Agenda" : null),
    m.file_count ? `${m.file_count} file${m.file_count === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link href={m.path} className="row">
      <span className={`row-when ${m.status === "planned" ? "planned" : ""}`}>
        {m.held_on.slice(8, 10)}
        <small>{MONTHS[Number(m.held_on.slice(5, 7)) - 1]}</small>
      </span>
      <span className="row-main">
        <b>{m.title}</b>
        {meta && <small>{meta}</small>}
      </span>
      {m.status === "planned" && <span className="tag planned">Planned</span>}
      <span className="chev" aria-hidden>→</span>
    </Link>
  );
}
