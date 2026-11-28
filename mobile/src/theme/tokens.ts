// Design tokens: "Neon Noir", ported from app/globals.css :root (see docs/design-system.md).
// Dark only. No boxed cards: hairlines separate. Use these for every color, radius and font size.

export const color = {
  bg: "#06080f",
  bg2: "#0b1020",
  ink: "#e8ecff",
  inkSoft: "#cdd5f5",
  muted: "#8a93b2",
  line: "rgba(238,241,255,0.12)",
  lineSoft: "rgba(238,241,255,0.08)",
  blue: "#2f7dff",
  navy: "#1d3a7a",
  blueEdge: "rgba(47,125,255,0.6)",
  amber: "#f5a524",
  red: "#ff4326",
  orange: "#ff7a1a",
  green: "#57d38c",
  gold: "#ffcf5a",
  surface: "rgba(18,22,35,0.62)",
  well: "rgba(10,14,26,0.5)",
  wellSoft: "rgba(10,14,26,0.4)",
  popover: "#0c101c",
  avatarFrom: "#1a2136",
  avatarTo: "#0e1424",
  white: "#ffffff",
  scrim: "rgba(0,0,0,0.55)",
  bannerTop: "rgba(5,8,15,0.1)",
  bannerMid: "rgba(5,8,15,0.45)",
} as const;

export const fs = {
  xs3: 9,
  xs2: 10,
  xs: 11,
  sm: 12,
  md: 13,
  base: 14,
  lg: 15,
  xl: 18,
  xl2: 22,
  xl3: 30,
  date: 34,
  display: 52,
  hero: 64,
  number: 72,
} as const;

export const radius = {
  btn: 2,
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 20,
} as const;

export const space = {
  rowY: 10,
  rowX: 12,
  tileY: 12,
  tileX: 14,
  gap: 8,
  rowGap: 12,
  section: 22,
  page: 20,
} as const;

export const font = {
  /** Archivo at 62% width, weight 900: titles, dates, big numbers. Always uppercase. */
  display: "ArchivoCondensed-Black",
  body: "Inter_400Regular",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

/** Uppercase label tracking (--track-label .28em), as letterSpacing at fs.xs. */
export const trackLabel = 3;
export const barH = 3;
export const bannerH = 200;
export const heroH = 420;

export const goalColor = {
  on_track: color.green,
  at_risk: color.amber,
  behind: color.red,
  hit: color.blue,
} as const;

export const goalLabel = {
  on_track: "On track",
  at_risk: "At risk",
  behind: "Behind",
  hit: "Hit",
} as const;
