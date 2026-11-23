import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { loadedRangeFor, rangeForView, isWithinRange } from "@/features/study-planner/range";
import { studySessionSchema } from "@/features/study-planner/validation";

describe("rangeForView (BP-038)", () => {
  test("daily is the anchor date", () => {
    assert.deepEqual(rangeForView("daily", "2026-11-26"), { start: "2026-11-26", end: "2026-11-26" });
  });
  test("weekly is Monday–Sunday", () => {
    assert.deepEqual(rangeForView("weekly", "2026-11-26"), { start: "2026-11-23", end: "2026-11-29" });
  });
  test("monthly is the calendar month (leap-year safe)", () => {
    assert.deepEqual(rangeForView("monthly", "2026-02-14"), { start: "2026-02-01", end: "2026-02-28" });
    assert.deepEqual(rangeForView("monthly", "2028-02-10"), { start: "2028-02-01", end: "2028-02-29" });
  });
  test("status spans 60 days back and 120 forward", () => {
    assert.deepEqual(rangeForView("status", "2026-11-26"), { start: "2026-09-27", end: "2027-03-26" });
  });
  test("loaded range covers every view around the anchor", () => {
    const loaded = loadedRangeFor("2026-11-26");
    for (const view of ["daily", "weekly", "monthly", "status"] as const) {
      const r = rangeForView(view, "2026-11-26");
      assert.ok(isWithinRange(r.start, loaded) && isWithinRange(r.end, loaded), view);
    }
    assert.equal(isWithinRange("2027-06-01", loaded), false);
  });
});

describe("studySessionSchema (BP-049)", () => {
  const base = { title: "Revise beams", study_date: "2026-11-26", start_time: "09:00", end_time: "10:00" };
  test("accepts a minimal valid session", () => {
    assert.equal(studySessionSchema.safeParse(base).success, true);
  });
  test("enforces length limits on update fields too", () => {
    assert.equal(studySessionSchema.safeParse({ ...base, notes: "x".repeat(1001) }).success, false);
    assert.equal(studySessionSchema.safeParse({ ...base, title: "x".repeat(151) }).success, false);
    assert.equal(studySessionSchema.safeParse({ ...base, location: "x".repeat(121) }).success, false);
  });
  test("course id must be a uuid or empty", () => {
    assert.equal(studySessionSchema.safeParse({ ...base, course_id: "not-a-uuid" }).success, false);
    assert.equal(studySessionSchema.safeParse({ ...base, course_id: "" }).success, true);
  });
});
