import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  getVerificationStatusLabel,
  validateVerificationRejectionReason,
  isVerificationStatusChangeAllowed,
  isVerificationReviewRecordValid,
} from "@/lib/verification";

describe("verification workflow helpers", () => {
  test("labels each verification state consistently for the UI", () => {
    assert.equal(getVerificationStatusLabel("pending"), "Pending review");
    assert.equal(getVerificationStatusLabel("verified"), "Verified");
    assert.equal(getVerificationStatusLabel("rejected"), "Rejected");
    assert.equal(getVerificationStatusLabel("suspended"), "Suspended");
  });

  test("rejects empty or weak reasons before an admin decision is recorded", () => {
    assert.throws(() => validateVerificationRejectionReason(""), /reason/i);
    assert.throws(() => validateVerificationRejectionReason("   "), /reason/i);
    assert.throws(() => validateVerificationRejectionReason("too short"), /at least 12/i);
    assert.equal(
      validateVerificationRejectionReason("Your matriculation number does not match the registration record."),
      "Your matriculation number does not match the registration record."
    );
  });

  test("students are blocked from mutating verification fields even when the UI is bypassed", () => {
    assert.equal(isVerificationStatusChangeAllowed("pending", "verified", false), true);
    assert.equal(isVerificationStatusChangeAllowed("pending", "verified", true), false);
    assert.equal(isVerificationStatusChangeAllowed("verified", "verified", true), false);
  });

  test("history records include the minimum required data for a valid review decision", () => {
    const record = {
      profileId: "11111111-1111-4111-8111-111111111111",
      previousStatus: "pending",
      newStatus: "rejected",
      reviewedBy: "22222222-2222-4222-8222-222222222222",
      rejectionReason: "Your matriculation number does not match the registration record.",
      createdAt: "2026-11-13T12:00:00.000Z",
    };

    assert.equal(isVerificationReviewRecordValid(record), true);
    assert.equal(
      isVerificationReviewRecordValid({
        ...record,
        rejectionReason: "",
        newStatus: "rejected",
      }),
      false
    );
  });
});
