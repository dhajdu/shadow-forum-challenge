// Design tokens, ported from app/globals.css :root (see docs/design-system.md).
// Dark only. Use these for every color, radius and font size in mobile/.

export const color = {
  bg: "#06080f",
  bg2: "#0b1020",
  ink: "#e8ecff",
  inkSoft: "#cdd5f5",
  muted: "#8a93b2",
  line: "rgba(255,255,255,0.08)",
  blue: "#2f7dff",
  navy: "#1d3a7a",
  blueEdge: "rgba(47,125,255,0.6)",
  amber: "#f5a524",
  red: "#ff4326",
  orange: "#ff7a1a",
  green: "#57d38c",
  gold: "#ffcf5a",
  surface: "rgba(18,22,35,0.6)",
  well: "rgba(10,14,26,0.5)",
  wellSoft: "rgba(10,14,26,0.4)",
  popover: "#0c101c",
  avatarFrom: "#1a2136",
  avatarTo: "#0e1424",
  white: "#ffffff",
} as const;

export const fs = {
  xs2: 10,
  xs: 11,
  sm: 12,
  md: 13,
  base: 14,
  lg: 15,
  xl: 18,
  xl2: 22,
  xl3: 30,
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 20,
} as const;

/** Spacing values in use on the web (no scale yet). */
export const space = {
  rowY: 10,
  rowX: 12,
  tileY: 12,
  tileX: 14,
  cardY: 20,
  cardX: 22,
  gap: 8,
  rowGap: 12,
  cardGap: 16,
  page: 20,
} as const;

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
