/**
 * Africa/Lagos date and time utilities.
 *
 * These tests run without a database and without relying on the host timezone:
 * every assertion passes an explicit UTC instant or a calendar date string.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  formatDisplayDate,
  formatShortDay,
  formatTime,
  formatTimestamp,
  formatWeekLabel,
  getDayOfMonth,
  getDayOfWeek,
  getLagosDateString,
  getLagosNow,
  getLagosTimeString,
  getWeekDates,
  getWeekDatesForDate,
  isValidDateString,
  normalizeTime,
  timeToMinutes,
} from "@/lib/dates";

describe("Lagos calendar date", () => {
  test("uses the Lagos calendar day when UTC is still the previous day", () => {
    // 23:30 UTC on 6 Oct is 00:30 WAT on 7 Oct.
    const instant = new Date("2025-10-06T23:30:00.000Z");
    assert.equal(getLagosDateString(instant), "2025-10-07");
    assert.equal(getLagosTimeString(instant), "00:30");
  });

  test("UTC to Lagos conversion is one hour ahead", () => {
    assert.equal(
      getLagosDateString(new Date("2025-10-06T22:59:59.000Z")),
      "2025-10-06"
    );
    assert.equal(
      getLagosDateString(new Date("2025-10-06T23:00:00.000Z")),
      "2025-10-07"
    );
  });

  test("returns a combined Lagos now value", () => {
    const now = getLagosNow(new Date("2025-10-06T23:45:00.000Z"));
    assert.deepEqual(now, { date: "2025-10-07", time: "00:45", minutes: 45 });
  });

  test("handles a Lagos midnight exactly", () => {
    assert.equal(
      getLagosDateString(new Date("2025-10-06T23:00:00.000Z")),
      "2025-10-07"
    );
    assert.equal(
      getLagosTimeString(new Date("2025-10-06T23:00:00.000Z")),
      "00:00"
    );
  });

  test("handles month and year transitions in Lagos", () => {
    assert.equal(
      getLagosDateString(new Date("2025-10-31T23:30:00.000Z")),
      "2025-11-01"
    );
    assert.equal(
      getLagosDateString(new Date("2025-12-31T23:30:00.000Z")),
      "2026-01-01"
    );
  });
});

describe("calendar date validation and arithmetic", () => {
  test("accepts real dates and rejects impossible dates", () => {
    assert.equal(isValidDateString("2025-10-06"), true);
    assert.equal(isValidDateString("2024-02-29"), true);
    assert.equal(isValidDateString("2025-02-29"), false);
    assert.equal(isValidDateString("2025-13-01"), false);
    assert.equal(isValidDateString("06/10/2025"), false);
  });

  test("adds days across month and year boundaries", () => {
    assert.equal(addDays("2025-10-31", 1), "2025-11-01");
    assert.equal(addDays("2025-12-31", 1), "2026-01-01");
    assert.equal(addDays("2026-01-01", -1), "2025-12-31");
    assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  });

  test("day of week and day of month are timezone-independent", () => {
    assert.equal(getDayOfWeek("2025-10-06"), 1); // Monday
    assert.equal(getDayOfWeek("2025-10-12"), 0); // Sunday
    assert.equal(getDayOfMonth("2025-10-06"), 6);
  });
});

describe("Monday–Sunday week boundaries", () => {
  test("a Monday reference starts that Monday", () => {
    const week = getWeekDates(new Date("2025-10-06T12:00:00.000Z"));
    assert.equal(week.weekStart, "2025-10-06");
    assert.equal(week.weekEnd, "2025-10-12");
    assert.equal(week.dates.length, 7);
  });

  test("a Sunday reference starts the previous Monday", () => {
    const week = getWeekDates(new Date("2025-10-12T12:00:00.000Z"));
    assert.equal(week.weekStart, "2025-10-06");
    assert.equal(week.weekEnd, "2025-10-12");
  });

  test("a Sunday late at night in Lagos still uses the Lagos Sunday", () => {
    // 23:30 Lagos on Sunday 12 Oct = 22:30 UTC.
    const week = getWeekDates(new Date("2025-10-12T22:30:00.000Z"));
    assert.equal(week.weekStart, "2025-10-06");
  });

  test("week offsets cross month and year boundaries", () => {
    const monthBoundary = getWeekDatesForDate("2025-10-01", 0);
    assert.equal(monthBoundary.weekStart, "2025-09-29");
    assert.equal(monthBoundary.weekEnd, "2025-10-05");

    const yearBoundary = getWeekDatesForDate("2026-01-01", 0);
    assert.equal(yearBoundary.weekStart, "2025-12-29");
    assert.equal(yearBoundary.weekEnd, "2026-01-04");

    const nextYearWeek = getWeekDatesForDate("2025-12-29", 1);
    assert.equal(nextYearWeek.weekStart, "2026-01-05");
  });

  test("negative offsets move backwards one week", () => {
    const week = getWeekDatesForDate("2025-10-06", -1);
    assert.equal(week.weekStart, "2025-09-29");
    assert.equal(week.weekEnd, "2025-10-05");
  });
});

describe("time-of-day helpers", () => {
  test("parses and normalises PostgreSQL time values", () => {
    assert.equal(timeToMinutes("00:00"), 0);
    assert.equal(timeToMinutes("09:30"), 570);
    assert.equal(timeToMinutes("23:59:59"), 1439 + 59 / 60);
    assert.equal(normalizeTime("09:30:00"), "09:30");
    assert.equal(normalizeTime("9:30"), "9:30"); // invalid, returned unchanged
  });

  test("formats morning, afternoon and near-midnight times", () => {
    assert.equal(formatTime("00:05"), "12:05 AM");
    assert.equal(formatTime("09:00:00"), "9:00 AM");
    assert.equal(formatTime("12:00"), "12:00 PM");
    assert.equal(formatTime("23:30:00"), "11:30 PM");
  });
});

describe("display formatting uses Africa/Lagos explicitly", () => {
  test("calendar dates render on their intended Lagos date", () => {
    // A lecture that starts at 23:30 Lagos on 6 Oct must remain Monday 6 Oct.
    const label = formatDisplayDate("2025-10-06", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    assert.match(label, /Monday/);
    assert.match(label, /6/);
    assert.match(label, /October/);
  });

  test("short weekday and week label formatting", () => {
    assert.equal(formatShortDay("2025-10-06"), "Mon");
    assert.match(formatWeekLabel("2025-10-06", "2025-10-12"), /6 Oct/);
    assert.match(formatWeekLabel("2025-10-06", "2025-10-12"), /12 Oct 2025/);
  });

  test("timestamps near UTC midnight render on the Lagos calendar day", () => {
    // 23:30 UTC on 6 Oct is 00:30 WAT on 7 Oct.
    const label = formatTimestamp("2025-10-06T23:30:00.000Z", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    assert.match(label, /7/);
    assert.match(label, /Oct/);
    assert.match(label, /2025/);
  });

  test("invalid timestamps degrade safely", () => {
    assert.equal(formatTimestamp("not-a-date"), "—");
  });
});
