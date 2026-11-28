import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_RULES,
  checkinGain,
  contestTracks,
  ladderStake,
  progressPoints,
  rulesOf,
  scoreGoal,
  seasonPeriods,
  whoopPoints,
  type GoalInput,
} from "./goal-points";

// A 4-week season: Mon 4 Jan to Sun 31 Jan 2027, weekly check-ins.
const season = { starts_on: "2027-01-04", ends_on: "2027-01-31" };
const base = (over: Partial<GoalInput> = {}): GoalInput => ({
  season,
  rules: DEFAULT_RULES,
  target: 2_000_000,
  checkins: [],
  today: "2027-02-01",
  ...over,
});

describe("seasonPeriods", () => {
  it("splits the season into periods from its first day; the last ends with the season", () => {
    assert.deepEqual(seasonPeriods(season, 7).map((p) => [p.start, p.end]), [
      ["2027-01-04", "2027-01-10"],
      ["2027-01-11", "2027-01-17"],
      ["2027-01-18", "2027-01-24"],
      ["2027-01-25", "2027-01-31"],
    ]);
    const odd = seasonPeriods({ starts_on: "2027-01-01", ends_on: "2027-01-20" }, 14);
    assert.deepEqual(odd.map((p) => [p.start, p.end]), [["2027-01-01", "2027-01-14"], ["2027-01-15", "2027-01-20"]]);
  });
});

describe("progressPoints", () => {
  it("scales up to the maximum by value / target, capped, and is 0 without a target", () => {
    assert.equal(progressPoints(1_000_000, 2_000_000, 50), 25);
    assert.equal(progressPoints(1_400_000, 2_000_000, 50), 35);
    assert.equal(progressPoints(5, 2, 50), 50);
    assert.equal(progressPoints(-3, 2, 50), 0);
    assert.equal(progressPoints(5, null, 50), 0);
    assert.equal(progressPoints(5, 0, 50), 0);
  });
});

describe("scoreGoal", () => {
  it("no check-ins: no points, every ended period missed", () => {
    const s = scoreGoal(base());
    assert.equal(s.points, 0);
    assert.equal(s.missed.length, 4);
    assert.equal(s.streak, 0);
    assert.equal(s.pct, null);
  });

  it("check-in, progress and streak points; the newest check-in in a period counts", () => {
    const s = scoreGoal(
      base({
        checkins: [
          { on: "2027-01-05", value: 200_000 }, // week 1, replaced by the next
          { on: "2027-01-08", value: 500_000 }, // week 1: 10 + 13
          { on: "2027-01-12", value: 1_000_000 }, // week 2: 10 + 25 + 10 streak
          { on: "2027-01-26", value: 1_400_000 }, // week 4: 10 + 35 (week 3 missed, no streak)
        ],
      })
    );
    assert.equal(s.checkinPoints, 30);
    assert.equal(s.progressPoints, 13 + 25 + 35);
    assert.equal(s.streakPoints, 10);
    assert.equal(s.goalPoints, 0);
    assert.equal(s.points, 30 + 73 + 10);
    assert.equal(s.checkins, 3);
    assert.deepEqual(s.missed.map((p) => p.start), ["2027-01-18"]);
    assert.equal(s.streak, 1);
    assert.equal(s.bestStreak, 2);
    assert.equal(s.pct, 70);
  });

  it("100 once for reaching the target, or for a goal marked hit", () => {
    const reached = scoreGoal(base({ checkins: [{ on: "2027-01-05", value: 2_000_000 }, { on: "2027-01-12", value: 2_100_000 }] }));
    assert.equal(reached.goalPoints, 100);
    assert.equal(reached.hitGoal, true);
    assert.equal(reached.points, 10 + 50 + 10 + 50 + 10 + 100);
    assert.equal(scoreGoal(base({ hit: true })).goalPoints, 100);
  });

  it("the period running today is not missed yet and does not break the streak", () => {
    const s = scoreGoal(base({ today: "2027-01-19", checkins: [{ on: "2027-01-05", value: 1 }, { on: "2027-01-13", value: 1 }] }));
    assert.equal(s.missed.length, 0);
    assert.equal(s.streak, 2);
    assert.equal(s.checkedInNow, false);
    assert.equal(s.nextDue, "2027-01-24");
    const done = scoreGoal(base({ today: "2027-01-19", checkins: [{ on: "2027-01-19", value: 1 }] }));
    assert.equal(done.checkedInNow, true);
    assert.equal(done.nextDue, "2027-01-31");
  });

  it("owes nothing before the member joined or set the goal, or after they left", () => {
    assert.equal(scoreGoal(base({ eligibleFrom: "2027-01-15" })).missed.length, 3, "week 2 is owed: the goal was set inside it");
    assert.equal(scoreGoal(base({ eligibleFrom: "2027-01-18" })).missed.length, 2);
    assert.equal(scoreGoal(base({ leftOn: "2027-01-18" })).missed.length, 2);
  });

  it("ignores check-ins outside the season or after today", () => {
    const s = scoreGoal(base({ today: "2027-01-12", checkins: [{ on: "2027-01-02", value: 9e9 }, { on: "2027-01-20", value: 9e9 }] }));
    assert.equal(s.points, 0);
  });

  it("follows the season's own rules", () => {
    const rules = rulesOf({ scoring: "goals", checkin_days: 14, points_checkin: 5, points_progress: 20, points_streak: 0, points_goal: 0 });
    const s = scoreGoal(base({ rules, checkins: [{ on: "2027-01-05", value: 1_000_000 }, { on: "2027-01-20", value: 2_000_000 }] }));
    assert.equal(s.points, 5 + 10 + 5 + 20);
    assert.equal(s.missed.length, 0);
  });
});

describe("checkinGain", () => {
  it("what a check-in today adds, as in the wireframe: progress and streak", () => {
    const g = base({ today: "2027-01-12", checkins: [{ on: "2027-01-06", value: 600_000 }] });
    const gain = checkinGain(g, 1_000_000);
    assert.deepEqual(gain, { checkin: 10, progress: 25, streak: 10, goal: 0, total: 45 });
    // a second check-in in the same period only adds the extra progress
    const again = checkinGain({ ...g, checkins: [...g.checkins, { on: "2027-01-11", value: 1_000_000 }] }, 1_400_000);
    assert.deepEqual(again, { checkin: 0, progress: 10, streak: 0, goal: 0, total: 10 });
  });
});

describe("rules and tracks", () => {
  it("defaults follow the plan; WHOOP needs the forum switch", () => {
    const r = rulesOf({ scoring: "both" });
    assert.equal(r.checkinDays, 7);
    assert.deepEqual([r.pointsCheckin, r.pointsProgress, r.pointsStreak, r.pointsGoal], [10, 50, 10, 100]);
    assert.equal(r.missedCheckinFine, null, "fines are off by default");
    assert.deepEqual(contestTracks(r, true), { goals: true, whoop: true });
    assert.deepEqual(contestTracks(r, false), { goals: true, whoop: false });
    assert.deepEqual(contestTracks(rulesOf({ scoring: "whoop" }), false), { goals: false, whoop: false });
    assert.equal(rulesOf({ scoring: "nonsense" }).scoring, null);
    assert.equal(rulesOf(null).scoring, null);
  });

  it("ladder stakes and WHOOP points", () => {
    const r = rulesOf({ ladder: [0, 2_000_000, 3_000_000] });
    assert.equal(ladderStake(r, 0), 0);
    assert.equal(ladderStake(r, 9), 3_000_000);
    assert.equal(ladderStake(rulesOf({ ladder: null }), 1), 0);
    // two weeks started, average score 80: 0.8 × 50 × 2
    assert.equal(whoopPoints(80, season, DEFAULT_RULES, "2027-01-12"), 80);
  });
});
