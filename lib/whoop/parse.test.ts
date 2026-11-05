import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blendScore, cycleDay, parseCycles, partialScore } from "./parse";

const CSV = [
  "Cycle start time,Recovery score %,Sleep performance %,Day Strain,Resting heart rate (bpm),Heart rate variability (ms)",
  "2026-10-17 08:00,,,12,48,30",
  "2026-10-18 10:00,80,70,10.5,50,40",
  "2026-10-18 19:30,55,60,9,51,41",
  "2026-10-19 08:00,90,,,55,45",
].join("\n");

describe("zip parser day labels", () => {
  it("keeps the 6pm cutoff without a wake onset and partial-scores incomplete days", () => {
    assert.equal(cycleDay("2026-10-18 17:09"), "2026-10-18");
    assert.equal(cycleDay("2026-10-18 19:30"), "2026-10-19");

    const days = parseCycles(CSV);
    const seventeenth = days.find((day) => day.day === "2026-10-17");
    const eighteenth = days.find((day) => day.day === "2026-10-18");
    const nineteenth = days.find((day) => day.day === "2026-10-19");

    // strain-only day: WHOOP never scored the sleep, so it counts on strain alone
    assert.equal(seventeenth?.score, partialScore(null, null, 12));
    assert.equal(eighteenth?.score, blendScore(80, 70, 10.5));
    // 19:30 rolls onto the 19th and is the scored row for that day (the 08:00 row is incomplete).
    assert.equal(nineteenth?.recovery, 55);
    assert.equal(nineteenth?.score, blendScore(55, 60, 9));
    assert.notEqual(nineteenth?.score, partialScore(90, null, null));
  });

  it("labels by wake onset when present, so a westward time zone change keeps both days", () => {
    const csv = [
      "Cycle start time,Recovery score %,Sleep performance %,Day Strain,Resting heart rate (bpm),Heart rate variability (ms),Wake onset",
      "2026-10-18 17:09:00,36,72,5.7,66,22,2026-10-19 01:00:02",
      "2026-10-18 00:57:16,19,27,5.5,72,33,2026-10-18 03:44:47",
    ].join("\n");
    const days = parseCycles(csv);
    assert.equal(days.find((day) => day.day === "2026-10-18")?.recovery, 19);
    assert.equal(days.find((day) => day.day === "2026-10-19")?.recovery, 36);
  });
});
