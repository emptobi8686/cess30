/**
 * Timetable scheduling rules.
 *
 * These are the pure rules used by the create/update/cancel/restore server
 * actions. Database enforcement (RLS, unique index) is covered by the live
 * scenarios in supabase/tests/rls_scenarios.sql.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  describeConflicts,
  findSessionConflicts,
  isSessionUpcoming,
  pickNextUpcomingSession,
  timesOverlap,
  validateLectureDate,
  validateSessionInput,
  validateTimeRange,
  type SessionConflict,
} from "@/features/timetable/validation";

const baseSession: SessionConflict = {
  id: "session-1",
  course_id: "course-a",
  lecture_date: "2025-10-06",
  start_time: "09:00:00",
  end_time: "10:00:00",
  venue: "LT1",
  is_cancelled: false,
  course_code: "CVE201",
};

function session(overrides: Partial<SessionConflict>): SessionConflict {
  return { ...baseSession, ...overrides };
}

describe("lecture session input validation", () => {
  test("accepts a valid session", () => {
    assert.equal(
      validateSessionInput({
        course_id: "course-a",
        lecture_date: "2025-10-06",
        start_time: "09:00",
        end_time: "10:00",
        venue: "LT1",
      }),
      null
    );
  });

  test("rejects invalid time ranges", () => {
    assert.match(validateTimeRange("10:00", "09:00") ?? "", /after start/i);
    assert.match(validateTimeRange("09:00", "09:00") ?? "", /after start/i);
    assert.match(validateTimeRange("25:00", "26:00") ?? "", /invalid/i);
    assert.match(validateTimeRange("09:00", "10:61") ?? "", /invalid/i);
  });

  test("accepts back-to-back and one-minute sessions", () => {
    assert.equal(validateTimeRange("10:00", "11:00"), null);
    assert.equal(validateTimeRange("08:00", "08:01"), null);
    assert.equal(validateTimeRange("23:00", "23:59"), null);
  });

  test("rejects missing and impossible calendar dates", () => {
    assert.match(validateLectureDate("") ?? "", /required/i);
    assert.match(validateLectureDate("2025-02-30") ?? "", /valid calendar/i);
    assert.equal(validateLectureDate("2025-02-28"), null);
  });

  test("rejects missing required fields", () => {
    assert.match(
      validateSessionInput({
        course_id: "",
        lecture_date: "2025-10-06",
        start_time: "09:00",
        end_time: "10:00",
        venue: "LT1",
      }) ?? "",
      /course/i
    );
    assert.match(
      validateSessionInput({
        course_id: "course-a",
        lecture_date: "2025-10-06",
        start_time: "09:00",
        end_time: "10:00",
        venue: "   ",
      }) ?? "",
      /venue/i
    );
  });
});

describe("overlap detection", () => {
  test("detects partial and containment overlaps", () => {
    assert.equal(timesOverlap("09:00", "10:00", "09:30", "10:30"), true);
    assert.equal(timesOverlap("09:00", "11:00", "09:30", "10:30"), true);
    assert.equal(timesOverlap("09:30", "10:30", "09:00", "11:00"), true);
  });

  test("does not treat back-to-back sessions as overlapping", () => {
    assert.equal(timesOverlap("09:00", "10:00", "10:00", "11:00"), false);
    assert.equal(timesOverlap("10:00", "11:00", "09:00", "10:00"), false);
  });

  test("returns false for invalid times rather than throwing", () => {
    assert.equal(timesOverlap("bad", "10:00", "09:00", "10:30"), false);
  });
});

describe("duplicate and conflict detection", () => {
  test("detects an identical active slot as a duplicate", () => {
    const conflicts = findSessionConflicts(
      {
        course_id: "course-a",
        lecture_date: "2025-10-06",
        start_time: "09:00",
        end_time: "10:00",
        venue: "LT1",
      },
      [baseSession]
    );
    assert.equal(conflicts.duplicates.length, 1);
  });

  test("ignores cancelled sessions", () => {
    const conflicts = findSessionConflicts(
      {
        course_id: "course-a",
        lecture_date: "2025-10-06",
        start_time: "09:00",
        end_time: "10:00",
        venue: "LT1",
      },
      [session({ is_cancelled: true })]
    );
    assert.equal(conflicts.duplicates.length, 0);
    assert.equal(conflicts.courseOverlaps.length, 0);
    assert.equal(conflicts.venueOverlaps.length, 0);
  });

  test("ignores the row being edited", () => {
    const conflicts = findSessionConflicts(
      {
        id: "session-1",
        course_id: "course-a",
        lecture_date: "2025-10-06",
        start_time: "09:00",
        end_time: "10:00",
        venue: "LT1",
      },
      [baseSession]
    );
    assert.equal(conflicts.duplicates.length, 0);
    assert.equal(conflicts.venueOverlaps.length, 0);
  });

  test("flags a course overlap separately from a venue overlap", () => {
    const conflicts = findSessionConflicts(
      {
        course_id: "course-a",
        lecture_date: "2025-10-06",
        start_time: "09:30",
        end_time: "10:30",
        venue: "LT2",
      },
      [baseSession]
    );
    assert.equal(conflicts.courseOverlaps.length, 1);
    assert.equal(conflicts.venueOverlaps.length, 0);
  });

  test("flags a venue overlap for a different course", () => {
    const conflicts = findSessionConflicts(
      {
        course_id: "course-b",
        lecture_date: "2025-10-06",
        start_time: "09:30",
        end_time: "10:30",
        venue: "lt1",
      },
      [baseSession]
    );
    assert.equal(conflicts.courseOverlaps.length, 0);
    assert.equal(conflicts.venueOverlaps.length, 1);
  });

  test("does not flag conflicts on a different date", () => {
    const conflicts = findSessionConflicts(
      {
        course_id: "course-a",
        lecture_date: "2025-10-07",
        start_time: "09:00",
        end_time: "10:00",
        venue: "LT1",
      },
      [baseSession]
    );
    assert.equal(conflicts.duplicates.length, 0);
    assert.equal(conflicts.courseOverlaps.length, 0);
    assert.equal(conflicts.venueOverlaps.length, 0);
  });

  test("describes conflicts for the admin UI", () => {
    assert.match(describeConflicts([baseSession]), /CVE201/);
    assert.match(describeConflicts([baseSession]), /09:00–10:00/);
  });
});

describe("next upcoming session", () => {
  test("a later session today is upcoming", () => {
    assert.equal(
      isSessionUpcoming(
        { lecture_date: "2025-10-06", end_time: "10:00", is_cancelled: false },
        "2025-10-06",
        "09:15"
      ),
      true
    );
  });

  test("a session that already ended today is not upcoming", () => {
    assert.equal(
      isSessionUpcoming(
        { lecture_date: "2025-10-06", end_time: "10:00", is_cancelled: false },
        "2025-10-06",
        "10:00"
      ),
      false
    );
  });

  test("a cancelled session is never upcoming", () => {
    assert.equal(
      isSessionUpcoming(
        { lecture_date: "2025-10-07", end_time: "10:00", is_cancelled: true },
        "2025-10-06",
        "09:00"
      ),
      false
    );
  });

  test("a session on a later Lagos date is upcoming", () => {
    assert.equal(
      isSessionUpcoming(
        { lecture_date: "2025-10-07", end_time: "08:00", is_cancelled: false },
        "2025-10-06",
        "23:59"
      ),
      true
    );
  });

  test("a near-midnight session belongs to its own Lagos date", () => {
    // At 00:05 on 7 Oct, a 23:30–23:59 session from 6 Oct has passed.
    assert.equal(
      isSessionUpcoming(
        { lecture_date: "2025-10-06", end_time: "23:59", is_cancelled: false },
        "2025-10-07",
        "00:05"
      ),
      false
    );
  });

  test("picks the first eligible session in order", () => {
    const sessions = [
      session({ id: "a", lecture_date: "2025-10-06", start_time: "08:00:00", end_time: "09:00:00" }),
      session({ id: "b", lecture_date: "2025-10-06", start_time: "11:00:00", end_time: "12:00:00" }),
      session({ id: "c", lecture_date: "2025-10-07", start_time: "08:00:00", end_time: "09:00:00" }),
    ];
    assert.equal(pickNextUpcomingSession(sessions, "2025-10-06", "10:00")?.id, "b");
  });
});
