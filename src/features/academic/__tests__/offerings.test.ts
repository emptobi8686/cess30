import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { bulkOfferingMessage, selectedCourseIds } from "@/features/academic/offerings";

describe("bulkOfferingMessage", () => {
  test("reports new and existing offerings", () => {
    assert.equal(bulkOfferingMessage(7, 7), "7 new offerings created.");
    assert.equal(bulkOfferingMessage(7, 0), "0 new offerings (7 already existed).");
    assert.equal(bulkOfferingMessage(3, 1), "1 new offering created (2 already existed).");
  });
});

describe("selectedCourseIds", () => {
  test("keeps unique UUIDs only", () => {
    const form = new FormData();
    form.append("courseId", "0b9f6e1c-6b8a-4c55-9d3f-1d2b6f4a9e10");
    form.append("courseId", "0b9f6e1c-6b8a-4c55-9d3f-1d2b6f4a9e10");
    form.append("courseId", "nope");
    assert.deepEqual(selectedCourseIds(form), ["0b9f6e1c-6b8a-4c55-9d3f-1d2b6f4a9e10"]);
  });
});
