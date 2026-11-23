import type { VerificationStatus } from "@/types";

/**
 * Server-side access model.
 *
 * Roles (user_roles) and verification status (profiles) are separate concepts:
 * a user may hold both the student and admin roles, and their student access
 * follows their own verification status.
 *
 * The pure functions here are the single source of truth for access decisions;
 * getAccessContext() (in ./access-server) only loads the inputs.
 */

export type AccessLevel = "none" | "read" | "full";

export type AppRole = "student" | "admin";

/** Staff capabilities approved by decision 0004 (P7). */
export type Capability = "department_admin" | "level_coordinator";

export type CapabilityRow = { capability: string; level_code: string | null };

export type AccessContext = {
  userId: string;
  /** Administrator or active department_admin assignment. */
  isAdmin: boolean;
  roles: AppRole[];
  verificationStatus: VerificationStatus;
  /** Levels this user coordinates as a course representative (sorted). */
  staffLevels: string[];
  /** Admin, or holds any active staff capability. Navigation only: the database authorises every write. */
  isStaff: boolean;
};

const KNOWN_ROLES: readonly AppRole[] = ["student", "admin"];
const KNOWN_STATUSES: readonly VerificationStatus[] = [
  "pending",
  "verified",
  "rejected",
  "suspended",
];

export function resolveAccess(
  userId: string,
  roleRows: Array<{ role: string }>,
  profile: { verification_status: string } | null,
  capabilityRows: CapabilityRow[] = []
): AccessContext {
  const roles = Array.from(
    new Set(
      roleRows
        .map((row) => row.role)
        .filter((role): role is AppRole => KNOWN_ROLES.includes(role as AppRole))
    )
  );

  const status = profile?.verification_status;
  const verificationStatus = KNOWN_STATUSES.includes(status as VerificationStatus)
    ? (status as VerificationStatus)
    : "pending";

  const isAdmin =
    roles.includes("admin") || capabilityRows.some((row) => row.capability === "department_admin");
  const staffLevels = Array.from(
    new Set(
      capabilityRows
        .filter((row) => row.capability === "level_coordinator" && row.level_code)
        .map((row) => row.level_code as string)
    )
  ).sort();

  return {
    userId,
    isAdmin,
    roles,
    verificationStatus,
    staffLevels,
    isStaff: isAdmin || staffLevels.length > 0,
  };
}

export function studentAccessLevel(ctx: AccessContext): AccessLevel {
  switch (ctx.verificationStatus) {
    case "verified":
      return "full";
    case "pending":
    case "rejected":
      return "read";
    case "suspended":
      return "none";
  }
}
