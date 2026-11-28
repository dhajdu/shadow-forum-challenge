import Link from "next/link";
import { getForumContext } from "@/app/_data/context";
import { getMeeting, listMeetings } from "@/app/_data/forum";
import { parseRecap, visibleParking } from "@/app/_data/recap";
import { shortDay } from "@/app/_data/format";
import { ParkingLot } from "../ParkingLot";
import s from "../forum.module.css";

// Topics: the forum's running Parking Lot, from the newest agenda, limited to topics from your first forum on.
export default async function TopicsPage() {
  const { db, viewer } = await getForumContext();
  const meetings = await listMeetings(db, viewer);
  const newest = meetings.find((m) => m.status === "held" && m.has_agenda);
  const doc = newest ? await getMeeting(db, viewer, newest.id) : null;
  const groups = doc?.body_md
    ? visibleParking(parseRecap(doc.body_md, doc.held_on).parking, viewer.forum_joined_on, viewer.is_founding)
    : [];
  const next = groups.flatMap((g) => g.topics).filter((t) => t.nextForum).length;

  return (
    <section className={s.agenda}>
      <p className={`note-line ${s.lead}`}>
        Topics members asked to bring back to the forum
        {next ? ` · ${next} marked for the next forum` : ""}
        {newest ? (
          <>
            {" "}· as of <Link href={newest.path} className="back">{shortDay(newest.held_on)}</Link>
          </>
        ) : null}
      </p>
      <ParkingLot groups={groups} />
    </section>
  );
}
