// Date formatting for forum pages. Times show in the forum's time zone
// (forum_settings.time_zone, from getForumSettings()).

/** Today as YYYY-MM-DD in the forum's time zone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone });
}

/** The zone's UTC offset on a day, as "+07:00" / "-05:00" / "+00:00". */
export function zoneOffset(timeZone: string, isoDay: string): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(new Date(`${isoDay}T12:00:00Z`))
    .find((p) => p.type === "timeZoneName")?.value;
  const m = name?.match(/GMT([+-]\d{2}):?(\d{2})?/);
  return m ? `${m[1]}:${m[2] ?? "00"}` : "+00:00";
}

/** "2026-12-23" + "18:00" (or "23:59:59") → "2026-12-23T18:00:00+07:00" in the forum's zone. */
export const localStamp = (timeZone: string, isoDay: string, time = "00:00") =>
  `${isoDay}T${time.split(":").length === 3 ? time.padStart(8, "0") : `${time.padStart(5, "0")}:00`}${zoneOffset(timeZone, isoDay)}`;

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** "Nov 25" */
export const shortDay = (iso: string) =>
  day(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "25 Nov 2026" */
export const longDay = (iso: string) =>
  day(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "Wed 23 Dec" */
export const weekdayDay = (iso: string) =>
  day(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "6:00 pm" */
export const timeOf = (isoDateTime: string, timeZone: string) =>
  new Date(isoDateTime)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone })
    .toLowerCase();

/** "Jan 2027" for a YYYY-MM month key. */
export const monthLabel = (ym: string) =>
  day(`${ym}-01`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
