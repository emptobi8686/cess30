import assert from "node:assert/strict";
import { test } from "node:test";
import { nextProgress } from "../progress";

test("progress grows, never shrinks, caps at 100 and completes at 90%", () => {
  assert.deepEqual(nextProgress(null, 30, 100), { percent: 30, status: "in_progress", lastPosition: 30 });
  assert.equal(nextProgress({ percent: 50, status: "in_progress" }, 10, 100).percent, 50);
  assert.equal(nextProgress(null, 95, 100).status, "completed");
  assert.equal(nextProgress(null, 500, 100).percent, 100);
  assert.equal(nextProgress({ percent: 100, status: "completed" }, 5, 100).status, "completed");
  assert.deepEqual(nextProgress(null, 10, 0), { percent: 0, status: "in_progress", lastPosition: 10 });
});
