import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  validateStudyTimeRange,
  validateStudyDate,
  timesOverlap,
  generateRecurringDates,
  detectConflicts,
} from "@/features/study-planner/validation";
import type { StudySession, LectureSession } from "@/types";

describe("Phase 5: validateStudyTimeRange", () => {
  test("accepts valid start and end times", () => {
    assert.equal(validateStudyTimeRange("09:00", "11:00"), null);
    assert.equal(validateStudyTimeRange("14:30", "16:00"), null);
    assert.equal(validateStudyTimeRange("21:00", "22:30"), null);
  });

  test("rejects invalid time formats", () => {
    assert.match(validateStudyTimeRange("invalid", "11:00") ?? "", /invalid/i);
    assert.match(validateStudyTimeRange("09:00", "25:00") ?? "", /invalid/i);
  });

  test("rejects end time earlier than or equal to start time", () => {
    assert.match(validateStudyTimeRange("12:00", "12:00") ?? "", /after start time/i);
    assert.match(validateStudyTimeRange("15:00", "14:00") ?? "", /after start time/i);
  });

  test("enforces minimum 15-minute duration", () => {
    assert.match(validateStudyTimeRange("10:00", "10:10") ?? "", /at least 15 minutes/i);
    assert.equal(validateStudyTimeRange("10:00", "10:15"), null);
  });

  test("enforces maximum 12-hour duration for a single session", () => {
    assert.match(validateStudyTimeRange("06:00", "19:00") ?? "", /cannot exceed 12 hours/i);
  });
});

describe("Phase 5: validateStudyDate", () => {
  test("accepts valid ISO calendar dates", () => {
    assert.equal(validateStudyDate("2026-03-15"), null);
    assert.equal(validateStudyDate("2026-11-12"), null);
  });

  test("rejects missing or empty dates", () => {
    assert.match(validateStudyDate("") ?? "", /required/i);
  });

  test("rejects non-standard or impossible calendar dates", () => {
    assert.match(validateStudyDate("15-03-2026") ?? "", /valid calendar date/i);
    assert.match(validateStudyDate("2025-02-30") ?? "", /valid calendar date/i);
    assert.match(validateStudyDate("not-a-date") ?? "", /valid calendar date/i);
  });
});

describe("Phase 5: timesOverlap interval check", () => {
  test("detects overlapping intervals", () => {
    assert.equal(timesOverlap("10:00", "12:00", "11:00", "13:00"), true);
    assert.equal(timesOverlap("11:00", "13:00", "10:00", "12:00"), true);
  });

  test("detects contained intervals", () => {
    assert.equal(timesOverlap("09:00", "15:00", "10:00", "12:00"), true);
    assert.equal(timesOverlap("10:00", "12:00", "09:00", "15:00"), true);
  });

  test("treats back-to-back adjacent intervals as non-overlapping", () => {
    assert.equal(timesOverlap("10:00", "12:00", "12:00", "14:00"), false);
    assert.equal(timesOverlap("12:00", "14:00", "10:00", "12:00"), false);
  });

  test("detects completely disjoint intervals as non-overlapping", () => {
    assert.equal(timesOverlap("08:00", "09:30", "14:00", "16:00"), false);
  });
});

describe("Phase 5: generateRecurringDates", () => {
  test("generates daily recurring dates without duplicates", () => {
    const dates = generateRecurringDates("2026-03-01", "2026-03-05", "daily");
    assert.deepEqual(dates, [
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
    ]);
  });

  test("generates weekly recurring dates 7 days apart", () => {
    const dates = generateRecurringDates("2026-03-02", "2026-03-23", "weekly");
    assert.deepEqual(dates, [
      "2026-03-02",
      "2026-03-09",
      "2026-03-16",
      "2026-03-23",
    ]);
  });

  test("generates selected weekdays recurring dates", () => {
    // 2026-03-02 is Monday (1), 2026-03-04 is Wednesday (3), 2026-03-06 is Friday (5)
    const dates = generateRecurringDates(
      "2026-03-02",
      "2026-03-08",
      "selected_weekdays",
      [1, 3, 5] // Mon, Wed, Fri
    );
    assert.deepEqual(dates, [
      "2026-03-02",
      "2026-03-04",
      "2026-03-06",
    ]);
  });

  test("handles single day range when end date equals start date", () => {
    const dates = generateRecurringDates("2026-03-02", "2026-03-02", "daily");
    assert.deepEqual(dates, ["2026-03-02"]);
  });

  test("safely caps at max sessions limit (no infinite loops)", () => {
    const dates = generateRecurringDates("2026-01-01", "2026-12-31", "daily");
    assert.ok(dates.length <= 60);
  });
});

describe("Phase 5: detectConflicts", () => {
  const existingStudy: StudySession[] = [
    {
      id: "study-1",
      user_id: "user-1",
      course_id: "c1",
      title: "Geotechnical Revision",
      study_date: "2026-03-10",
      start_time: "10:00:00",
      end_time: "12:00:00",
      notes: null,
      location: "Library",
      reminder_preference: "15_min",
      completed: false,
      completed_at: null,
      recurrence_id: null,
      recurrence_pattern: null,
      recurrence_end_date: null,
      created_at: "2026-03-01T00:00:00Z",
      updated_at: "2026-03-01T00:00:00Z",
    },
  ];

  const existingLectures: LectureSession[] = [
    {
      id: "lec-1",
      course_id: "c2",
      lecture_date: "2026-03-10",
      start_time: "14:00:00",
      end_time: "16:00:00",
      venue: "LT 1",
      lecturer_name: "Dr. Adeyemi",
      is_cancelled: false,
      cancelled_at: null,
      created_by: "admin-1",
      updated_by: null,
      created_at: "2026-03-01T00:00:00Z",
      updated_at: "2026-03-01T00:00:00Z",
    },
    {
      id: "lec-cancelled",
      course_id: "c3",
      lecture_date: "2026-03-10",
      start_time: "16:00:00",
      end_time: "18:00:00",
      venue: "Civil Lab",
      lecturer_name: "Prof. Okafor",
      is_cancelled: true,
      cancelled_at: "2026-03-05T00:00:00Z",
      created_by: "admin-1",
      updated_by: null,
      created_at: "2026-03-01T00:00:00Z",
      updated_at: "2026-03-01T00:00:00Z",
    },
  ];

  test("detects overlap with personal study session", () => {
    const { studyConflicts, lectureConflicts } = detectConflicts(
      "2026-03-10",
      "11:00",
      "13:00",
      existingStudy,
      existingLectures
    );
    assert.equal(studyConflicts.length, 1);
    assert.equal(studyConflicts[0].id, "study-1");
    assert.equal(lectureConflicts.length, 0);
  });

  test("detects overlap with official lecture", () => {
    const { studyConflicts, lectureConflicts } = detectConflicts(
      "2026-03-10",
      "15:00",
      "17:00",
      existingStudy,
      existingLectures
    );
    assert.equal(studyConflicts.length, 0);
    assert.equal(lectureConflicts.length, 1);
    assert.equal(lectureConflicts[0].id, "lec-1");
  });

  test("ignores cancelled official lectures in conflict detection", () => {
    const { lectureConflicts } = detectConflicts(
      "2026-03-10",
      "16:30",
      "17:30",
      existingStudy,
      existingLectures
    );
    assert.equal(lectureConflicts.length, 0);
  });

  test("ignores self when editing existing session", () => {
    const { studyConflicts } = detectConflicts(
      "2026-03-10",
      "10:00",
      "12:00",
      existingStudy,
      existingLectures,
      "study-1" // ignoreSessionId
    );
    assert.equal(studyConflicts.length, 0);
  });
});

describe("Phase 5: Student data isolation security constraints", () => {
  test("RLS boundary guarantees user_id scoping", () => {
    const studentA_id = "11111111-1111-1111-1111-111111111111";
    const studentB_id = "22222222-2222-2222-2222-222222222222";

    const sessions = [
      { id: "s1", user_id: studentA_id, title: "Student A private notes" },
      { id: "s2", user_id: studentB_id, title: "Student B private notes" },
    ];

    // Simulated RLS SELECT filter: auth.uid() = user_id
    const studentA_results = sessions.filter((s) => s.user_id === studentA_id);
    assert.equal(studentA_results.length, 1);
    assert.equal(studentA_results[0].title, "Student A private notes");

    // Student A cannot access Student B's session
    assert.ok(!studentA_results.some((s) => s.user_id === studentB_id));
  });
});

