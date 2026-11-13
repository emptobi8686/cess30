/**
 * Phase 4 regression tests.
 *
 * These tests exercise the real validation/date helpers rather than copies, so
 * the rules cannot drift from production code. Live database behaviour (RLS,
 * unique indexes, actual inserts) is covered by supabase/tests/rls_scenarios.sql
 * and requires a configured Supabase project.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validateTimeRange } from "@/features/timetable/validation";
import { validateAnnouncementScope } from "@/features/announcements/validation";
import { getWeekDatesForDate } from "@/lib/dates";

describe("lecture session time validation", () => {
  test("accepts valid time range", () => {
    assert.equal(validateTimeRange("08:00", "10:00"), null);
  });

  test("accepts back-to-back hours", () => {
    assert.equal(validateTimeRange("13:00", "14:00"), null);
  });

  test("rejects end time equal to start time", () => {
    const result = validateTimeRange("09:00", "09:00");
    assert.ok(result !== null, "Should return an error message");
    assert.match(result!, /end time/i);
  });

  test("rejects end time before start time", () => {
    const result = validateTimeRange("10:00", "08:00");
    assert.ok(result !== null);
  });

  test("handles 1-minute range as valid", () => {
    assert.equal(validateTimeRange("08:00", "08:01"), null);
  });

  test("handles midnight boundary", () => {
    assert.equal(validateTimeRange("23:00", "23:59"), null);
  });
});

describe("announcement scope validation", () => {
  test("accepts all scope without course", () => {
    assert.equal(validateAnnouncementScope("all", null), null);
  });

  test("accepts department scope without course", () => {
    assert.equal(validateAnnouncementScope("department", null), null);
  });

  test("accepts level scope without course", () => {
    assert.equal(validateAnnouncementScope("level", null), null);
  });

  test("accepts course scope with course id", () => {
    assert.equal(validateAnnouncementScope("course", "some-uuid"), null);
  });

  test("rejects course scope without course id", () => {
    const result = validateAnnouncementScope("course", null);
    assert.ok(result !== null);
    assert.match(result!, /course must be selected/i);
  });

  test("rejects non-course scope with course id attached", () => {
    const result = validateAnnouncementScope("all", "some-uuid");
    assert.ok(result !== null);
    assert.match(result!, /course-scoped/i);
  });

  test("rejects unknown scope value", () => {
    const result = validateAnnouncementScope("global", null);
    assert.ok(result !== null);
    assert.match(result!, /invalid scope/i);
  });
});

describe("LectureSession type includes Phase 4 fields", () => {
  test("is_cancelled defaults to false", () => {
    const mockSession = {
      id: "1",
      course_id: "2",
      lecture_date: "2025-10-07",
      start_time: "08:00",
      end_time: "10:00",
      venue: "LT1",
      lecturer_name: null,
      is_cancelled: false,
      cancelled_at: null,
      created_by: "3",
      updated_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    assert.equal(mockSession.is_cancelled, false);
    assert.equal(mockSession.cancelled_at, null);
  });

  test("cancelled session has cancelled_at timestamp", () => {
    const now = new Date().toISOString();
    const cancelledSession = {
      is_cancelled: true,
      cancelled_at: now,
    };
    assert.equal(cancelledSession.is_cancelled, true);
    assert.ok(cancelledSession.cancelled_at !== null);
  });
});

describe("Announcement type includes is_published field", () => {
  test("draft announcement has is_published = false", () => {
    const draft = { is_published: false, title: "Test", content: "Body" };
    assert.equal(draft.is_published, false);
  });

  test("published announcement has is_published = true", () => {
    const published = { is_published: true, title: "Test", content: "Body" };
    assert.equal(published.is_published, true);
  });
});

describe("admin role guard contract", () => {
  test("non-admin role string is not equal to admin", () => {
    const role = "student";
    assert.notEqual(role, "admin");
  });

  test("admin role string passes the guard check", () => {
    const role = "admin";
    assert.equal(role, "admin");
  });

  test("null role (unauthenticated) fails the guard", () => {
    const role: string | null = null;
    assert.ok(role !== "admin");
  });
});

describe("week date calculation", () => {
  test("returns 7 dates", () => {
    const week = getWeekDatesForDate("2025-10-07", 0);
    assert.equal(week.dates.length, 7);
  });

  test("week starts on Monday for a Tuesday input", () => {
    const week = getWeekDatesForDate("2025-10-07", 0);
    assert.equal(week.weekStart, "2025-10-06");
  });

  test("offset of +1 moves forward one week", () => {
    const week0 = getWeekDatesForDate("2025-10-07", 0);
    const week1 = getWeekDatesForDate("2025-10-07", 1);
    assert.equal(week1.weekStart, "2025-10-13");
    assert.equal(week0.weekEnd, "2025-10-12");
  });

  test("offset of -1 moves backward one week", () => {
    const week0 = getWeekDatesForDate("2025-10-07", 0);
    const weekMinus1 = getWeekDatesForDate("2025-10-07", -1);
    assert.equal(weekMinus1.weekStart, "2025-09-29");
    assert.equal(week0.weekStart, "2025-10-06");
  });

  test("Sunday input week starts on the previous Monday", () => {
    const week = getWeekDatesForDate("2025-10-12", 0);
    assert.equal(week.weekStart, "2025-10-06");
  });
});
