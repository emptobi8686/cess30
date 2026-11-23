import assert from "node:assert/strict";
import { test } from "node:test";
import { isEnrolmentType, levelEnrolMessage } from "../enrollments";

test("isEnrolmentType accepts only known types", () => {
  assert.equal(isEnrolmentType("carryover"), true);
  assert.equal(isEnrolmentType("core"), true);
  assert.equal(isEnrolmentType("visitor"), false);
});

test("levelEnrolMessage pluralises and explains a no-op", () => {
  assert.equal(levelEnrolMessage("200", 1), "1 enrolment added for level 200.");
  assert.equal(levelEnrolMessage("300", 4), "4 enrolments added for level 300.");
  assert.match(levelEnrolMessage("200", 0), /already enrolled/);
});
