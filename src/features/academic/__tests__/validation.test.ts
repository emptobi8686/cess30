import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { semesterSchema, sessionSchema } from "@/features/academic/validation";

describe("sessionSchema", () => {
  test("label must be consecutive years", () => {
    assert.equal(sessionSchema.safeParse({ label: "2025/2026", starts_on: "2025-10-01", ends_on: "2026-09-30" }).success, true);
    assert.equal(sessionSchema.safeParse({ label: "2025/2027", starts_on: "2025-10-01", ends_on: "2026-09-30" }).success, false);
  });
  test("start must precede end", () => {
    assert.equal(sessionSchema.safeParse({ label: "2025/2026", starts_on: "2026-10-01", ends_on: "2026-09-30" }).success, false);
  });
});

describe("semesterSchema", () => {
  const base = { number: "1", label: "First Semester", starts_on: "2025-10-06", ends_on: "2026-02-27" };
  test("accepts a valid semester and coerces the number", () => {
    const r = semesterSchema.safeParse(base);
    assert.equal(r.success && r.data.number, 1);
  });
  test("rejects numbers outside 1–3 and invalid dates", () => {
    assert.equal(semesterSchema.safeParse({ ...base, number: "4" }).success, false);
    assert.equal(semesterSchema.safeParse({ ...base, starts_on: "2026-13-01" }).success, false);
  });
});
