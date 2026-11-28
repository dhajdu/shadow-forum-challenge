// Contest season helpers shared across the app.
//
// Seasons live in the seasons table: dates, and since 0034 the contest rules
// (name, scoring, check-in rhythm, points, stakes). Scoring and rules are in
// lib/goal-points.ts; this file is about which season and which day.
import { rulesOf, type SeasonRuleColumns } from "@/lib/goal-points";

// ── Seasons ─────────────────────────────────────────────
export type ContestSeason = SeasonRuleColumns & {
  id: string;
  slug: string;
  name: string;
  starts_on: string; // YYYY-MM-DD
  ends_on: string;
  metric?: string | null;
};

const DAY_MS = 86_400_000;
const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const todayStr = (now = new Date()) => now.toISOString().slice(0, 10);

/** The season a day belongs to: the latest one that had started (same as public.season_of). */
export function seasonForDay<T extends Pick<ContestSeason, "starts_on">>(seasons: T[], day = todayStr()): T | null {
  let best: T | null = null;
  for (const s of seasons) if (s.starts_on <= day && (!best || s.starts_on > best.starts_on)) best = s;
  return best;
}

/** The season to lock goals into: the newest one, started or not (e.g. Q1 2027 during December). */
export function newestSeason<T extends Pick<ContestSeason, "starts_on">>(seasons: T[]): T | null {
  return seasons.reduce<T | null>((a, s) => (!a || s.starts_on > a.starts_on ? s : a), null);
}

export function seasonLength(s: Pick<ContestSeason, "starts_on" | "ends_on">): number {
  return Math.round((dayMs(s.ends_on) - dayMs(s.starts_on)) / DAY_MS) + 1;
}

/** 1-based day of the season, clamped to 0..length. */
export function dayOfSeason(s: Pick<ContestSeason, "starts_on" | "ends_on">, now = new Date()): number {
  const day = Math.floor((dayMs(todayStr(now)) - dayMs(s.starts_on)) / DAY_MS) + 1;
  return Math.max(0, Math.min(seasonLength(s), day));
}

export function seasonPhase(s: Pick<ContestSeason, "starts_on" | "ends_on">, now = new Date()): "upcoming" | "running" | "over" {
  const t = todayStr(now);
  return t < s.starts_on ? "upcoming" : t > s.ends_on ? "over" : "running";
}

/** Placement stakes (whole units of the forum's currency) for the season, from its ladder. */
export function seasonLadder(s: Pick<ContestSeason, "ladder"> | null): number[] {
  return rulesOf(s).ladder;
}

/** Whether the season has a contest: the forum picked its scoring. A season has none until then. */
export function hasContest(s: Pick<ContestSeason, "scoring"> | null): boolean {
  return rulesOf(s).scoring != null;
}

/** Placement stake for a 0-based rank, in whole units. 0 without a ladder. */
export function seasonPenalty(s: Pick<ContestSeason, "ladder"> | null, rankIndex: number): number {
  const ladder = seasonLadder(s);
  return ladder.length ? ladder[Math.min(rankIndex, ladder.length - 1)] : 0;
}

/** The contest's name: the season's own, else "<season> contest". */
export const contestName = (s: Pick<ContestSeason, "name" | "contest_name">) => s.contest_name?.trim() || `${s.name} contest`;
