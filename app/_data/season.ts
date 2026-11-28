import { seasonForDay } from "@/lib/contest";
import { listSeasons, type Db, type Season, type Viewer } from "./forum";

/** The contest season for today, among those the member can see. */
export async function contestSeason(db: Db, v: Viewer): Promise<Season | null> {
  return seasonForDay(await listSeasons(db, v));
}

/** The contest season for today (Q4 2026 until Q1 2027 starts), among those the member can see. */
export async function contestSeasonId(db: Db, v: Viewer): Promise<string | null> {
  return (await contestSeason(db, v))?.id ?? null;
}
