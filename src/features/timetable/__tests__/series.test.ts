import assert from "node:assert/strict";
import { test } from "node:test";
import { expandWeeklySeries } from "../series";

const base = { startTime: "09:00", endTime: "11:00" };

test("Mon+Wed over two weeks with one skipped date", () => {
  assert.deepEqual(
    expandWeeklySeries({ ...base, offeringSemester: { starts_on: "2026-11-02", ends_on: "2026-11-15" }, weekdays: [1, 3], skipDates: ["2026-11-04"] }),
    ["2026-11-02", "2026-11-09", "2026-11-11"]
  );
});

test("no weekdays → no dates", () => {
  assert.deepEqual(expandWeeklySeries({ ...base, offeringSemester: { starts_on: "2026-11-02", ends_on: "2026-11-15" }, weekdays: [], skipDates: [] }), []);
});

test("a two-year range is capped at 120 dates", () => {
  const dates = expandWeeklySeries({ ...base, offeringSemester: { starts_on: "2026-01-01", ends_on: "2027-12-31" }, weekdays: [1, 2, 3, 4, 5], skipDates: [] });
  assert.equal(dates.length, 120);
});
