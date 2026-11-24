/** Database messages that are safe to show as-is (raised by migration 033's RPCs). */
export const STAFF_RPC_MESSAGES = [
  "Department administrator access required.",
  "You cannot grant a capability to yourself.",
  "That capability is not enabled yet.",
  "Give a reason of at least 8 characters.",
  "A course representative must be assigned to one level.",
  "A department administrator has department-wide scope.",
  "Only verified students can be given staff capabilities.",
  "Open an academic session before appointing course representatives.",
  "The expiry must be in the future.",
  "That person is already the course representative for this level.",
  "There is no pending grant to approve.",
  "Another department administrator must approve this.",
  "That assignment is not active.",
  "Ask another department administrator to remove your own access.",
] as const;

export function staffRpcMessage(error: { message?: string }, fallback: string): string {
  return error.message && (STAFF_RPC_MESSAGES as readonly string[]).includes(error.message) ? error.message : fallback;
}

export const CAPABILITY_LABELS: Record<string, string> = {
  department_admin: "Department administrator",
  level_coordinator: "Course representative",
};

export function assignmentStatusLabel(row: { status: string; expires_at: string | null }, now = new Date()): string {
  if (row.status === "revoked") return "Revoked";
  if (row.status === "pending_approval") return "Pending approval";
  if (row.expires_at && new Date(row.expires_at) <= now) return "Expired";
  return "Active";
}
