import assert from "node:assert/strict";
import { test } from "node:test";
import { planResolution } from "../review-dispatch";

const ID = "00000000-0000-0000-0000-0000000000aa";
const OFF = "00000000-0000-0000-0000-0000000000bb";

test("announcement_level becomes a level audience", () => {
  assert.deepEqual(planResolution({ item_type: "announcement_level", entity_id: "a" }, { level_code: "200" }), {
    kind: "insert_audience",
    payload: { announcement_id: "a", audience_kind: "level", level_code: "200" },
  });
});

test("quest_audience accepts a level or the department", () => {
  assert.deepEqual(planResolution({ item_type: "quest_audience", entity_id: ID }, { audience: "department" }), {
    kind: "insert_audience",
    payload: { quest_id: ID, audience_kind: "department" },
  });
  assert.deepEqual(planResolution({ item_type: "quest_audience", entity_id: ID }, { audience: "300" }).payload, {
    quest_id: ID, audience_kind: "level", level_code: "300",
  });
});

test("lecture_out_of_range links an offering; placement confirms; dismiss works for any item", () => {
  assert.deepEqual(planResolution({ item_type: "lecture_out_of_range", entity_id: ID }, { offering_id: OFF }), {
    kind: "set_lecture_offering",
    payload: { lecture_id: ID, offering_id: OFF },
  });
  assert.deepEqual(planResolution({ item_type: "placement", entity_id: ID }, {}), { kind: "confirm_placement", payload: { placement_id: ID } });
  assert.deepEqual(planResolution({ item_type: "profile_no_matric", entity_id: ID }, {}), { kind: "dismiss", payload: {} });
  assert.deepEqual(planResolution({ item_type: "announcement_level", entity_id: ID }, { decision: "dismiss" }), { kind: "dismiss", payload: {} });
});

test("invalid input and unknown item types throw", () => {
  assert.throws(() => planResolution({ item_type: "announcement_level", entity_id: "a" }, { level_code: "999" }));
  assert.throws(() => planResolution({ item_type: "lecture_out_of_range", entity_id: ID }, { offering_id: "nope" }));
  assert.throws(() => planResolution({ item_type: "mystery", entity_id: ID }, {}));
});
