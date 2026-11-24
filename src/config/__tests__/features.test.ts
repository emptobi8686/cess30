import assert from "node:assert/strict";
import { test } from "node:test";
import { visibleAdminNav } from "@/components/shared/admin-nav";
import { tutorialsEnabled } from "../features";

test("tutorials are off unless explicitly switched on", () => {
  assert.equal(tutorialsEnabled(undefined), false);
  assert.equal(tutorialsEnabled("1"), false);
  assert.equal(tutorialsEnabled("true"), true);
});

test("the admin menu hides Tutorials while it is off", () => {
  assert.ok(!visibleAdminNav(true, { tutorials: false }).some((i) => i.label === "Tutorials"));
  assert.ok(visibleAdminNav(true, { tutorials: true }).some((i) => i.label === "Tutorials"));
});
