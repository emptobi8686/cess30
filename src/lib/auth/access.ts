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

export type AccessContext = {
  userId: string;
  isAdmin: boolean;
  roles: AppRole[];
  verificationStatus: VerificationStatus;
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
  profile: { verification_status: string } | null
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

  return {
    userId,
    isAdmin: roles.includes("admin"),
    roles,
    verificationStatus,
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
