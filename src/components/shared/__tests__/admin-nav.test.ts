import assert from "node:assert/strict";
import { test } from "node:test";
import { visibleAdminNav } from "../admin-nav";

test("course representatives do not see verification or staff management", () => {
  const labels = visibleAdminNav(false).map((item) => item.label);
  assert.ok(!labels.includes("Verifications"));
  assert.ok(!labels.includes("Staff"));
  assert.ok(labels.includes("Timetable") && labels.includes("Academic"));
});

test("admins see everything", () => {
  assert.equal(visibleAdminNav(true).length, 10);
});
