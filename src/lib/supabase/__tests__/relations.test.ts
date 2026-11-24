import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { firstRelation } from "@/lib/supabase/relations";

describe("firstRelation", () => {
  test("object relations (many-to-one) pass through", () => {
    assert.deepEqual(firstRelation({ a: 1 }), { a: 1 });
  });
  test("array relations return the first element", () => {
    assert.deepEqual(firstRelation([{ a: 1 }, { a: 2 }]), { a: 1 });
  });
  test("empty and missing relations are null", () => {
    assert.equal(firstRelation([]), null);
    assert.equal(firstRelation(null), null);
    assert.equal(firstRelation(undefined), null);
  });
});
