import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { countOf } from "@/features/admin/overview-core";

describe("countOf", () => {
  test("reads the count from a PostgREST head response", () => {
    assert.equal(countOf({ count: 3 }), 3);
  });
  test("missing counts are zero", () => {
    assert.equal(countOf({ count: null }), 0);
    assert.equal(countOf(null), 0);
  });
  test("a numeric value passes through (already-unwrapped helpers)", () => {
    assert.equal(countOf(7), 7);
  });
});
