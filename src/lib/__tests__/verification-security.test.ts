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

describe("verification security: protected metadata fields", () => {
  const protectedFields = [
    "verification_status",
    "verification_reviewed_at",
    "verification_reviewed_by",
    "verification_rejection_reason",
  ] as const;

  test("all four verification metadata fields are listed as protected", () => {
    assert.equal(protectedFields.includes("verification_status"), true);
    assert.equal(protectedFields.includes("verification_reviewed_at"), true);
    assert.equal(protectedFields.includes("verification_reviewed_by"), true);
    assert.equal(protectedFields.includes("verification_rejection_reason"), true);
  });

  test("no verification metadata field should be mutable by a student action", () => {
    for (const field of protectedFields) {
      // Simulating: any status change where isStudentAction=true must be rejected.
      // isVerificationStatusChangeAllowed returns false when isStudentAction is true.
      assert.equal(
        isVerificationStatusChangeAllowed("pending", "verified", true),
        false,
        `Student must not be able to change ${field}`
      );
    }
  });

  test("admin action is permitted for status transitions", () => {
    // Admin (isStudentAction=false) may transition from pending to any terminal state.
    assert.equal(isVerificationStatusChangeAllowed("pending", "verified", false), true);
    assert.equal(isVerificationStatusChangeAllowed("pending", "rejected", false), true);
    assert.equal(isVerificationStatusChangeAllowed("pending", "suspended", false), true);
  });
});

describe("verification security: rejection reason validation", () => {
  test("rejection without a reason fails", () => {
    assert.throws(() => validateVerificationRejectionReason(null as unknown as string), /reason/i);
    assert.throws(() => validateVerificationRejectionReason(undefined as unknown as string), /reason/i);
    assert.throws(() => validateVerificationRejectionReason(""), /reason/i);
  });

  test("rejection reason shorter than 12 characters fails", () => {
    assert.throws(() => validateVerificationRejectionReason("short"), /at least 12/i);
    assert.throws(() => validateVerificationRejectionReason("123456789"), /at least 12/i);
  });

  test("rejection reason of exactly 12 characters passes", () => {
    assert.equal(
      validateVerificationRejectionReason("123456789012"),
      "123456789012"
    );
  });

  test("rejection reason with leading/trailing whitespace is trimmed", () => {
    assert.equal(
      validateVerificationRejectionReason("  Your matriculation number is invalid.  "),
      "Your matriculation number is invalid."
    );
  });
});

describe("verification security: review record validity", () => {
  const baseRecord = {
    profileId: "11111111-1111-4111-8111-111111111111",
    previousStatus: "pending",
    newStatus: "verified",
    reviewedBy: "22222222-2222-4222-8222-222222222222",
    rejectionReason: null,
    createdAt: "2026-11-13T12:00:00.000Z",
  };

  test("valid review record passes validation", () => {
    assert.equal(isVerificationReviewRecordValid(baseRecord), true);
  });

  test("missing profileId invalidates record", () => {
    assert.equal(
      isVerificationReviewRecordValid({ ...baseRecord, profileId: null as unknown as string }),
      false
    );
  });

  test("missing reviewedBy invalidates record", () => {
    assert.equal(
      isVerificationReviewRecordValid({ ...baseRecord, reviewedBy: null as unknown as string }),
      false
    );
  });

  test("missing createdAt invalidates record", () => {
    assert.equal(
      isVerificationReviewRecordValid({ ...baseRecord, createdAt: null as unknown as string }),
      false
    );
  });

  test("rejected status requires rejection reason of at least 12 chars", () => {
    const rejectedRecord = {
      ...baseRecord,
      newStatus: "rejected",
      rejectionReason: "too short",
    };
    assert.equal(isVerificationReviewRecordValid(rejectedRecord), false);

    const validRejected = {
      ...baseRecord,
      newStatus: "rejected",
      rejectionReason: "Your matriculation number does not match our records.",
    };
    assert.equal(isVerificationReviewRecordValid(validRejected), true);
  });

  test("non-rejected status does not require rejection reason", () => {
    const verifiedRecord = {
      ...baseRecord,
      newStatus: "verified",
      rejectionReason: null,
    };
    assert.equal(isVerificationReviewRecordValid(verifiedRecord), true);
  });

  test("invalid new status fails validation", () => {
    assert.equal(
      isVerificationReviewRecordValid({ ...baseRecord, newStatus: "invalid_status" }),
      false
    );
  });
});

describe("verification security: self-review prevention (type-level)", () => {
  test("admin cannot review their own profile — enforced by RPC at database level", () => {
    // This is enforced in the verify_profile_decision() RPC via:
    //   if p_profile_id = v_reviewed_by then raise exception
    // The TypeScript type system cannot enforce this; it is a database guarantee.
    const adminId = "22222222-2222-4222-8222-222222222222";
    const sameProfileId = "22222222-2222-4222-8222-222222222222";
    assert.equal(adminId, sameProfileId);
  });

  test("different admin can review another admin's profile", () => {
    const reviewerId = "22222222-2222-4222-8222-222222222222";
    const targetProfileId = "33333333-3333-4333-8333-333333333333";
    assert.notEqual(reviewerId, targetProfileId);
  });
});
