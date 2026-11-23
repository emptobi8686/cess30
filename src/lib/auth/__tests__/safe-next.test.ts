import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "@/lib/auth/safe-next";

describe("safeNextPath (BP-020)", () => {
  test("control characters cannot smuggle a protocol-relative URL", () => {
    assert.equal(safeNextPath("/\t/evil.example", "/dashboard"), "/dashboard");
    assert.equal(safeNextPath("/\n/evil.example", "/dashboard"), "/dashboard");
    assert.equal(safeNextPath("/\r/evil.example", "/dashboard"), "/dashboard");
  });
  test("absolute, protocol-relative and backslash URLs fall back", () => {
    assert.equal(safeNextPath("https://evil.example", "/d"), "/d");
    assert.equal(safeNextPath("//evil.example", "/d"), "/d");
    assert.equal(safeNextPath("/\\evil.example", "/d"), "/d");
    assert.equal(safeNextPath(null, "/d"), "/d");
  });
  test("same-origin paths keep their query and hash", () => {
    assert.equal(safeNextPath("/quests?x=1#top", "/d"), "/quests?x=1#top");
    assert.equal(safeNextPath("/reset-password/update", "/d"), "/reset-password/update");
  });
});
