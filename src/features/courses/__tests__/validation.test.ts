import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { courseSchema } from "@/features/courses/validation";

describe("courseSchema", () => {
  test("normalises the course code and coerces units", () => {
    const r = courseSchema.safeParse({ course_code: " cee301 ", course_title: "Structures I", credit_units: "3", level: "300" });
    assert.equal(r.success, true);
    assert.deepEqual(r.success && r.data, { course_code: "CEE301", course_title: "Structures I", credit_units: 3, level: "300" });
  });
  test("rejects invalid units, codes and levels", () => {
    const base = { course_code: "CEE301", course_title: "Structures I", credit_units: "3", level: "300" };
    assert.equal(courseSchema.safeParse({ ...base, credit_units: "0" }).success, false);
    assert.equal(courseSchema.safeParse({ ...base, credit_units: "7" }).success, false);
    assert.equal(courseSchema.safeParse({ ...base, course_code: "CE30" }).success, false);
    assert.equal(courseSchema.safeParse({ ...base, level: "600" }).success, false);
    assert.equal(courseSchema.safeParse({ ...base, course_title: "AB" }).success, false);
  });
});
