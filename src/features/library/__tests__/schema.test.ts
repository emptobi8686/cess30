import assert from "node:assert/strict";
import { test } from "node:test";
import { libraryResourceSchema, normaliseTags } from "../schema";

const base = {
  title: "Beam Theory Notes",
  description: "Simply supported beams.",
  resource_type: "course_notes",
  copyright_basis: "own_work",
  licence_note: "",
  tags: "",
  course_id: "",
  level_code: "200",
  attestation: "on",
};

test("a complete resource parses", () => {
  const r = libraryResourceSchema.safeParse(base);
  assert.equal(r.success, true);
  assert.equal(r.success && r.data.course_id, null);
});

test("the copyright attestation is required", () => {
  assert.equal(libraryResourceSchema.safeParse({ ...base, attestation: undefined }).success, false);
});

test("past questions need the approved basis", () => {
  const r = libraryResourceSchema.safeParse({ ...base, resource_type: "past_question", copyright_basis: "own_work" });
  assert.equal(r.success, false);
  assert.equal(libraryResourceSchema.safeParse({ ...base, resource_type: "past_question", copyright_basis: "approved_past_question" }).success, true);
});

test("tags are trimmed, lowercased and de-duplicated", () => {
  assert.deepEqual(normaliseTags(["Beams ", " beams", "Statics"]), ["beams", "statics"]);
  const r = libraryResourceSchema.safeParse({ ...base, tags: "Beams , beams,  Statics" });
  assert.deepEqual(r.success && r.data.tags, ["beams", "statics"]);
  assert.equal(libraryResourceSchema.safeParse({ ...base, tags: Array.from({ length: 11 }, (_, i) => `t${i}`).join(",") }).success, false);
});
