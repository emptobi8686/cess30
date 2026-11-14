export const VERIFICATION_STATUS_VALUES = [
  "pending",
  "verified",
  "rejected",
  "suspended",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUS_VALUES)[number];

export function getVerificationStatusLabel(status: string): string {
  switch ((status ?? "pending").toLowerCase()) {
    case "pending":
      return "Pending review";
    case "verified":
      return "Verified";
    case "rejected":
      return "Rejected";
    case "suspended":
      return "Suspended";
    default:
      return "Pending review";
  }
}

export function validateVerificationRejectionReason(reason: string | null | undefined): string {
  const trimmed = typeof reason === "string" ? reason.trim() : "";

  if (!trimmed) {
    throw new Error("A rejection reason is required.");
  }

  if (trimmed.length < 12) {
    throw new Error("Rejection reason must be at least 12 characters.");
  }

  return trimmed;
}

export function isVerificationStatusChangeAllowed(
  previousStatus: string,
  nextStatus: string,
  isStudentAction: boolean
): boolean {
  const safePrevious = (previousStatus ?? "pending").toLowerCase();
  const safeNext = (nextStatus ?? "pending").toLowerCase();

  if (safePrevious === safeNext) {
    return false;
  }

  if (!VERIFICATION_STATUS_VALUES.includes(safeNext as VerificationStatus)) {
    return false;
  }

  return !isStudentAction;
}

export function isVerificationReviewRecordValid(record: {
  profileId?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  createdAt?: string | null;
}): boolean {
  if (!record.profileId || !record.reviewedBy || !record.createdAt) {
    return false;
  }

  const nextStatus = (record.newStatus ?? "pending").toLowerCase();
  if (!VERIFICATION_STATUS_VALUES.includes(nextStatus as VerificationStatus)) {
    return false;
  }

  if (nextStatus === "rejected") {
    const rejectionReason = String(record.rejectionReason ?? "").trim();
    return rejectionReason.length >= 12;
  }

  return true;
}
