import assert from "node:assert/strict";
import { test } from "node:test";
import { audienceListSchema, describeAudience, parseAudienceField, scopeForAudiences } from "../schema";

const OFFERING = "00000000-0000-0000-0000-0000000a0301";

test("level audience requires a level code", () => {
  assert.equal(audienceListSchema.safeParse([{ audience_kind: "level" }]).success, false);
});

test("two level rows are accepted (explicit cross-level sharing)", () => {
  const r = audienceListSchema.safeParse([
    { audience_kind: "level", level_code: "200" },
    { audience_kind: "level", level_code: "300" },
  ]);
  assert.equal(r.success, true);
});

test("unknown levels and malformed ids are rejected; at most 20 rows", () => {
  assert.equal(audienceListSchema.safeParse([{ audience_kind: "level", level_code: "700" }]).success, false);
  assert.equal(audienceListSchema.safeParse([{ audience_kind: "offering", offering_id: "x" }]).success, false);
  const many = Array.from({ length: 21 }, () => ({ audience_kind: "department" }));
  assert.equal(audienceListSchema.safeParse(many).success, false);
});

test("parseAudienceField reads the hidden JSON input and de-duplicates", () => {
  const raw = JSON.stringify([
    { audience_kind: "offering", offering_id: OFFERING },
    { audience_kind: "offering", offering_id: OFFERING },
  ]);
  const r = parseAudienceField(raw);
  assert.equal(r.ok && r.audiences.length, 1);
  assert.equal(parseAudienceField("not json").ok, false);
  assert.deepEqual(parseAudienceField(""), { ok: true, audiences: [] });
});

test("legacy scope column follows the first audience", () => {
  assert.deepEqual(scopeForAudiences([{ audience_kind: "department" }]), { scope: "department", course_id: null });
  assert.deepEqual(scopeForAudiences([{ audience_kind: "level", level_code: "300" }]), { scope: "level", course_id: null });
  assert.deepEqual(scopeForAudiences([]), { scope: "department", course_id: null });
});

test("describeAudience labels rows for badges", () => {
  assert.equal(describeAudience({ audience_kind: "level", level_code: "300" }), "Level 300");
  assert.equal(describeAudience({ audience_kind: "department" }), "Department");
  assert.equal(describeAudience({ audience_kind: "offering", offering_id: OFFERING }, { [OFFERING]: "GET209 · Level 200" }), "GET209 · Level 200");
});

test("audienceBadge joins rows and flags hidden items", async () => {
  const { audienceBadge } = await import("../schema");
  assert.equal(audienceBadge([]), "Hidden (no audience)");
  assert.equal(
    audienceBadge([
      { audience_kind: "level", level_code: "300", course_id: null, offering_id: null },
      { audience_kind: "offering", level_code: null, course_id: null, offering_id: OFFERING, course_offerings: { level_code: "200", courses: { course_code: "GET209" } } },
    ]),
    "Level 300 · GET209 (Level 200)"
  );
});
