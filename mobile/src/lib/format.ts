const tz = "Asia/Ho_Chi_Minh";
const at = (day: string) => new Date(`${day}T12:00:00Z`);

/** "Nov 25" */
export const short = (day: string) => at(day).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
/** "Wed 23 Dec" */
export const weekday = (day: string) =>
  at(day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");
/** "28 Jul 2026" */
export const long = (day: string) => at(day).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
/** "6:00 pm" in Vietnam time */
export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).toLowerCase();
/** "TUE 25 NOV 2026" */
export const stamp = (day: string) =>
  at(day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).replace(",", "").toUpperCase();

export function ago(iso: string, now = Date.now()): string {
  const min = Math.round((now - Date.parse(iso)) / 60000);
  if (min < 60) return `${Math.max(1, min)} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)} days ago`;
}
