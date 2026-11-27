// Date formatting for forum pages. Forums are in Vietnam, so times show in Asia/Ho_Chi_Minh.
const TZ = "Asia/Ho_Chi_Minh";

/** Today as YYYY-MM-DD in Vietnam. */
export function todayVN(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: TZ });
}

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
export const timeOf = (isoDateTime: string) =>
  new Date(isoDateTime)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ })
    .toLowerCase();

/** "Jan 2027" for a YYYY-MM month key. */
export const monthLabel = (ym: string) =>
  day(`${ym}-01`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
