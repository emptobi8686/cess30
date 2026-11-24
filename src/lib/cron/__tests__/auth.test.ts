import assert from "node:assert/strict";
import { test } from "node:test";
import { isAuthorizedCron } from "../auth";

test("accepts only the exact bearer secret", () => {
  assert.equal(isAuthorizedCron("Bearer s3cret-value", "s3cret-value"), true);
  assert.equal(isAuthorizedCron(null, "s3cret-value"), false);
  assert.equal(isAuthorizedCron("Bearer wrong", "s3cret-value"), false);
  assert.equal(isAuthorizedCron("s3cret-value", "s3cret-value"), false);
  assert.equal(isAuthorizedCron("Bearer s3cret-value", undefined), false);
});
