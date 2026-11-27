import Link from "next/link";
import type { Meeting } from "@/app/_data/forum";
import { shortDay } from "@/app/_data/format";

export function MeetingRow({ m }: { m: Meeting }) {
  const meta = [
    m.status === "planned" ? "Coming" : m.has_agenda ? "Agenda" : null,
    m.file_count ? `${m.file_count} file${m.file_count === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link href={m.path} className="row">
      <span className="row-when">{shortDay(m.held_on)}</span>
      <span className="row-main">
        <b>{m.title}</b>
        {meta && <small>{meta}</small>}
      </span>
      {m.status === "planned" && <span className="tag planned">planned</span>}
      <span className="chev" aria-hidden>›</span>
    </Link>
  );
}
