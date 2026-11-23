import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { toAcademicContext } from "@/features/academic/context-core";

describe("toAcademicContext", () => {
  test("no row means no placement", () => {
    assert.deepEqual(toAcademicContext(null, [], null), {
      sessionLabel: null,
      semesterLabel: null,
      levelCode: null,
      placementStatus: "none",
      offeringIds: [],
    });
  });

  test("a confirmed placement exposes its level", () => {
    const ctx = toAcademicContext(
      { level_code: "300", placement_status: "confirmed" },
      [{ offering_id: "a" }, { offering_id: "b" }],
      { session: "2026/2027", semester: "First Semester" }
    );
    assert.equal(ctx.levelCode, "300");
    assert.equal(ctx.placementStatus, "confirmed");
    assert.deepEqual(ctx.offeringIds, ["a", "b"]);
    assert.equal(ctx.sessionLabel, "2026/2027");
  });

  test("a claimed placement keeps its level but is not confirmed", () => {
    const ctx = toAcademicContext({ level_code: "400", placement_status: "claimed" }, [], null);
    assert.equal(ctx.placementStatus, "claimed");
    assert.equal(ctx.levelCode, "400");
  });

  test("unknown statuses are treated as no placement", () => {
    assert.equal(toAcademicContext({ level_code: "400", placement_status: "weird" }, [], null).placementStatus, "none");
  });
});
