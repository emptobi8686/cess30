import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildPushPayload } from "@/lib/notifications/payload";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/notifications/defaults";
import { lectureCourse, eligibleNotificationProfiles } from "@/lib/notifications/rows";

describe("buildPushPayload", () => {
  test("type-specific titles, truncated body, safe action URL", () => {
    const payload = buildPushPayload({
      id: "n1",
      notification_type: "announcement",
      title: "x".repeat(200),
      action_url: "//evil.example",
    });
    assert.equal(payload.notificationId, "n1");
    assert.equal(payload.title, "New announcement");
    assert.equal(payload.body.length, 120);
    assert.equal(payload.actionUrl, "/notifications");
  });
  test("each type has its own title", () => {
    const t = (notification_type: "lecture_reminder" | "study_reminder" | "system") =>
      buildPushPayload({ id: "n", notification_type, title: "T", action_url: "/timetable" }).title;
    assert.equal(t("lecture_reminder"), "Lecture reminder");
    assert.equal(t("study_reminder"), "Study session reminder");
    assert.equal(t("system"), "BLUEPRINT update");
  });
});

describe("DEFAULT_NOTIFICATION_PREFERENCES (BP-048)", () => {
  test("mirrors the column defaults in 013_notifications.sql", () => {
    assert.deepEqual(DEFAULT_NOTIFICATION_PREFERENCES, {
      push_enabled: false,
      lecture_reminders_enabled: true,
      study_reminders_enabled: true,
      announcement_notifications_enabled: true,
      lecture_reminder_minutes: 30,
      quiet_hours_enabled: false,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
    });
  });
});

describe("lectureCourse (BP-012)", () => {
  test("reads an object-shaped embedded course (PostgREST many-to-one)", () => {
    const row = {
      id: "l1",
      lecture_date: "2026-11-24",
      start_time: "09:00:00",
      is_cancelled: false,
      courses: { course_code: "GET209", department: "Civil Engineering", level: "200" },
    };
    assert.deepEqual(lectureCourse(row), { course_code: "GET209", department: "Civil Engineering", level: "200" });
  });
  test("still reads array-shaped relations", () => {
    const row = {
      id: "l1", lecture_date: "2026-11-24", start_time: "09:00:00", is_cancelled: false,
      courses: [{ course_code: "GET209", department: "Civil Engineering", level: "200" }],
    };
    assert.equal(lectureCourse(row)?.course_code, "GET209");
  });
});

describe("eligibleNotificationProfiles (BP-032)", () => {
  const profiles = [
    { id: "verified", department: "Civil Engineering", level: "200", verification_status: "verified" },
    { id: "pending", department: "Civil Engineering", level: "200", verification_status: "pending" },
    { id: "admin-only", department: "Civil Engineering", level: "200", verification_status: "verified" },
    { id: "admin-student", department: "Civil Engineering", level: "200", verification_status: "verified" },
  ];
  const roles = [
    { user_id: "admin-only", role: "admin" },
    { user_id: "admin-student", role: "admin" },
    { user_id: "admin-student", role: "student" },
  ];
  test("only verified students, including admins who are also students", () => {
    assert.deepEqual(
      eligibleNotificationProfiles(profiles, roles).map((p) => p.id),
      ["verified", "admin-student"]
    );
  });
});
