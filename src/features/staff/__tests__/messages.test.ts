import assert from "node:assert/strict";
import { test } from "node:test";
import { assignmentStatusLabel, staffRpcMessage } from "../messages";

test("known RPC messages pass through; unknown ones become the fallback", () => {
  assert.equal(staffRpcMessage({ message: "You cannot grant a capability to yourself." }, "x"), "You cannot grant a capability to yourself.");
  assert.equal(staffRpcMessage({ message: 'relation "staff_assignments" does not exist' }, "Could not grant."), "Could not grant.");
});

test("assignment status labels", () => {
  const now = new Date("2027-01-01T00:00:00Z");
  assert.equal(assignmentStatusLabel({ status: "pending_approval", expires_at: null }, now), "Pending approval");
  assert.equal(assignmentStatusLabel({ status: "active", expires_at: "2026-12-31T00:00:00Z" }, now), "Expired");
  assert.equal(assignmentStatusLabel({ status: "active", expires_at: "2027-10-01T00:00:00Z" }, now), "Active");
  assert.equal(assignmentStatusLabel({ status: "revoked", expires_at: null }, now), "Revoked");
});
