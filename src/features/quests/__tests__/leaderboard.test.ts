import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseLeaderboardPeriod } from "@/features/quests/leaderboard";

describe("parseLeaderboardPeriod", () => {
  test("accepts supported periods", () => {
    assert.equal(parseLeaderboardPeriod("weekly"), "weekly");
    assert.equal(parseLeaderboardPeriod("monthly"), "monthly");
    assert.equal(parseLeaderboardPeriod("all-time"), "all-time");
  });
  test("falls back to all-time", () => {
    assert.equal(parseLeaderboardPeriod("garbage"), "all-time");
    assert.equal(parseLeaderboardPeriod(undefined), "all-time");
    assert.equal(parseLeaderboardPeriod(""), "all-time");
  });
  test("uses the first value of repeated params", () => {
    assert.equal(parseLeaderboardPeriod(["monthly", "weekly"]), "monthly");
  });
});
