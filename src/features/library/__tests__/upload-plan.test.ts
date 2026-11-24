import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizeDecision, planObjectPath } from "../upload-plan";

test("object paths are server-generated from ids and the detected extension", () => {
  assert.equal(planObjectPath("r1", "f1", "pdf"), "resources/r1/f1.pdf");
});

test("finalise accepts valid files and deletes rejected ones", () => {
  assert.deepEqual(finalizeDecision({ ok: true, mime: "application/pdf", ext: "pdf" }), { action: "accept" });
  assert.deepEqual(finalizeDecision({ ok: false, reason: "content_mismatch" }), {
    action: "reject",
    deleteObject: true,
    message: "The file content does not match its type.",
  });
});
