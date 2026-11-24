import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarDays,
  getLagosDateAndTime,
  getReminderMinutes,
  isWithinQuietHours,
  lagosLocalTimeToUtc,
} from "@/lib/notifications/time";
import {
  getSafeActionUrl,
  isSafePushEndpoint,
} from "@/lib/notifications/validation";

describe("notification time handling", () => {
  test("converts Africa/Lagos wall time to UTC across midnight", () => {
    assert.equal(
      lagosLocalTimeToUtc("2026-03-15", "09:00").toISOString(),
      "2026-03-15T08:00:00.000Z"
    );
    assert.equal(
      lagosLocalTimeToUtc("2026-03-15", "00:15").toISOString(),
      "2026-03-14T23:15:00.000Z"
    );
    assert.deepEqual(
      getLagosDateAndTime(new Date("2026-03-14T23:15:00.000Z")),
      { date: "2026-03-15", time: "00:15", minutes: 15 }
    );
  });

  test("uses Lagos calendar arithmetic and reminder interval values", () => {
    assert.equal(addCalendarDays("2026-03-31", 1), "2026-04-01");
    assert.equal(getReminderMinutes("1_day"), 1440);
    assert.equal(getReminderMinutes("none"), null);
  });

  test("respects quiet hours that cross midnight in Africa/Lagos", () => {
    assert.equal(
      isWithinQuietHours(
        new Date("2026-03-14T23:00:00.000Z"),
        true,
        "22:00",
        "07:00"
      ),
      true
    );
    assert.equal(
      isWithinQuietHours(
        new Date("2026-03-15T07:30:00.000Z"),
        true,
        "22:00",
        "07:00"
      ),
      false
    );
    assert.equal(
      isWithinQuietHours(
        new Date("2026-03-15T12:00:00.000Z"),
        false,
        "22:00",
        "07:00"
      ),
      false
    );
  });
});

describe("notification endpoint and action URL validation", () => {
  test("allows supported public push services and rejects untrusted endpoints", () => {
    assert.equal(
      isSafePushEndpoint("https://fcm.googleapis.com/fcm/send/opaque-token"),
      true
    );
    assert.equal(
      isSafePushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/opaque-token"),
      true
    );
    assert.equal(isSafePushEndpoint("http://fcm.googleapis.com/send"), false);
    assert.equal(isSafePushEndpoint("https://127.0.0.1/admin"), false);
    assert.equal(isSafePushEndpoint("https://example.com/push"), false);
  });

  test("keeps action URLs on the app origin", () => {
    assert.equal(getSafeActionUrl("/timetable?week=next"), "/timetable?week=next");
    assert.equal(getSafeActionUrl("https://example.com"), "/notifications");
    assert.equal(getSafeActionUrl("//example.com"), "/notifications");
    assert.equal(getSafeActionUrl("/\\example.com"), "/notifications");
  });
});

// Announcement and lecture targeting moved to SQL (E4/E5): supabase/tests/database/340_notification_targeting.test.sql
