import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isExternallySynced } from "./config";
import { daysFromWhoop, toWhoopDayRows, type WhoopCycleRecord, type WhoopRecoveryRecord, type WhoopSleepRecord } from "./map";
import { blendScore, partialScore } from "./parse";

function cycle(partial: Partial<WhoopCycleRecord> & Pick<WhoopCycleRecord, "id" | "start">): WhoopCycleRecord {
  return { timezone_offset: "+07:00", score_state: "SCORED", ...partial };
}

function recovery(partial: Partial<WhoopRecoveryRecord> & Pick<WhoopRecoveryRecord, "cycle_id">): WhoopRecoveryRecord {
  return { score_state: "SCORED", ...partial };
}

function sleep(partial: Partial<WhoopSleepRecord> & Pick<WhoopSleepRecord, "cycle_id">): WhoopSleepRecord {
  return { score_state: "SCORED", nap: false, ...partial };
}

describe("WHOOP API → whoop_days", () => {
  it("labels days by the main sleep's local wake date and reuses blendScore", () => {
    // Dave, 10-18: flew UTC+11 → UTC+07, went to bed at 17:09 local and woke on the 19th.
    const days = daysFromWhoop({
      cycles: [
        cycle({ id: 1, start: "2026-10-17T13:57:16.000Z", timezone_offset: "+11:00", score: { strain: 5.5 } }),
        cycle({ id: 2, start: "2026-10-18T10:09:00.000Z", timezone_offset: "+07:00", score: { strain: 5.7 } }),
        // no sleep at all: falls back to the 6pm local-start rule (19:00 +07 → next date)
        cycle({ id: 3, start: "2026-10-20T12:00:00.000Z", timezone_offset: "+07:00", score: { strain: 4.2 } }),
      ],
      recoveries: [
        recovery({ cycle_id: 1, score: { recovery_score: 19, resting_heart_rate: 72.4, hrv_rmssd_milli: 33.04 } }),
        recovery({ cycle_id: 2, score: { recovery_score: 36, resting_heart_rate: 66, hrv_rmssd_milli: 22 } }),
      ],
      sleeps: [
        sleep({ cycle_id: 1, end: "2026-10-17T16:44:47.000Z", score: { sleep_performance_percentage: 27 } }),
        sleep({ cycle_id: 2, end: "2026-10-18T18:00:02.000Z", score: { sleep_performance_percentage: 72 } }),
      ],
    });

    const eighteenth = days.find((day) => day.day === "2026-10-18");
    const nineteenth = days.find((day) => day.day === "2026-10-19");
    assert.ok(eighteenth);
    assert.ok(nineteenth);
    assert.equal(eighteenth.recovery, 19);
    assert.equal(eighteenth.resting_hr, 72);
    assert.equal(eighteenth.hrv, 33);
    assert.equal(eighteenth.score, blendScore(19, 27, 5.5));
    assert.equal(nineteenth.recovery, 36);
    assert.equal(nineteenth.score, blendScore(36, 72, 5.7));
    assert.equal(days.find((day) => day.day === "2026-10-21")?.strain, 4.2);
  });

  it("ignores naps and keeps the scored cycle when two land on one day", () => {
    const days = daysFromWhoop({
      cycles: [
        cycle({ id: 1, start: "2026-10-18T01:00:00.000Z", timezone_offset: "+00:00", score_state: "PENDING_SCORE", score: null }),
        cycle({ id: 2, start: "2026-10-18T02:00:00.000Z", timezone_offset: "+00:00", score: { strain: 8 } }),
      ],
      recoveries: [
        recovery({ cycle_id: 2, score: { recovery_score: 60, resting_heart_rate: 55, hrv_rmssd_milli: 42 } }),
      ],
      sleeps: [
        sleep({ cycle_id: 2, nap: true, end: "2026-10-18T03:00:00.000Z", score: { sleep_performance_percentage: 10 } }),
        sleep({ cycle_id: 2, nap: false, end: "2026-10-18T08:00:00.000Z", score: { sleep_performance_percentage: 88 } }),
      ],
    });
    assert.equal(days.length, 1);
    assert.equal(days[0].day, "2026-10-18");
    assert.equal(days[0].sleep, 88);
    assert.equal(days[0].strain, 8);
    assert.equal(days[0].score, blendScore(60, 88, 8));
  });

  it("partial-scores every incomplete day, not only the newest", () => {
    const days = daysFromWhoop({
      cycles: [
        cycle({ id: 1, start: "2026-10-17T01:00:00.000Z", timezone_offset: "+00:00", score: { strain: 12 } }),
        cycle({ id: 2, start: "2026-10-18T01:00:00.000Z", timezone_offset: "+00:00", score_state: "PENDING_SCORE", score: null }),
      ],
      recoveries: [recovery({ cycle_id: 2, score: { recovery_score: 90, resting_heart_rate: 48, hrv_rmssd_milli: 70 } })],
      sleeps: [],
    });
    const older = days.find((day) => day.day === "2026-10-17");
    const newest = days.find((day) => day.day === "2026-10-18");
    // strain-only: WHOOP never scored the sleep
    assert.equal(older?.score, partialScore(null, null, 12));
    assert.equal(newest?.score, partialScore(90, null, null));
    assert.equal(newest?.score, 90);
  });

  it("writes API rows with missed false and no upload id", () => {
    const days = daysFromWhoop({
      cycles: [cycle({ id: 1, start: "2026-10-18T01:00:00.000Z", timezone_offset: "Z", score: { strain: 4 } })],
      recoveries: [recovery({ cycle_id: 1, score: { recovery_score: 70, resting_heart_rate: 52, hrv_rmssd_milli: 61 } })],
      sleeps: [sleep({ cycle_id: 1, score: { sleep_performance_percentage: 80 } })],
    });
    const rows = toWhoopDayRows("user-1", days);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, "user-1");
    assert.equal(rows[0].missed, false);
    assert.equal(rows[0].upload_id, null);
    assert.equal(rows[0].score, blendScore(rows[0].recovery, rows[0].sleep, rows[0].strain));
  });

  it("does not treat an externally synced user as eligible", () => {
    const dave = "11111111-1111-1111-1111-111111111111";
    assert.equal(isExternallySynced(dave, `${dave}, 22222222-2222-2222-2222-222222222222`), true);
    assert.equal(isExternallySynced("33333333-3333-3333-3333-333333333333", dave), false);
    assert.equal(isExternallySynced(dave, ""), false);
  });
});
