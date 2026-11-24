/**
 * Allow-listed auth messages (audit finding BP-040). Redirects carry a short code in
 * ?error= / ?message=; pages render only the fixed copy for known codes, so crafted
 * links cannot display arbitrary text on BLUEPRINT pages.
 */
export const AUTH_MESSAGES = {
  oauth_cancelled: "Google sign-in was cancelled. Please try again when you are ready.",
  account_exists:
    "An account with this email already exists. Sign in with your email and password, or use your original sign-in method.",
  link_expired: "Your sign-in link has expired. Please request a new one.",
  recovery_expired: "Your password recovery link has expired. Request a new link to continue.",
  verification_expired: "Your verification link has expired. Please request a new one.",
  signin_failed: "We couldn't complete your sign-in. Please try again.",
  not_configured: "Authentication is not configured. Contact the administrator.",
  password_updated: "Password updated successfully. Sign in with your new password.",
  registration_submitted: "Registration submitted. Check your email to confirm your account, then sign in.",
} as const;

export type AuthMessageCode = keyof typeof AUTH_MESSAGES;

export function messageFromCode(code: string | string[] | undefined | null): string | null {
  const value = Array.isArray(code) ? code[0] : code;
  if (!value || !Object.hasOwn(AUTH_MESSAGES, value)) return null;
  return AUTH_MESSAGES[value as AuthMessageCode];
}

/** Maps provider error parameters to a message code; provider text is never echoed. */
export function formatOAuthError(errorCode: string | null, errorDescription: string | null): AuthMessageCode {
  const code = (errorCode ?? "").toLowerCase();
  const description = (errorDescription ?? "").toLowerCase();

  if (
    code === "access_denied" ||
    description.includes("cancelled") ||
    description.includes("canceled") ||
    description.includes("access denied")
  ) {
    return "oauth_cancelled";
  }

  if (
    code.includes("identity_already_exists") ||
    description.includes("already registered") ||
    description.includes("multiple accounts") ||
    description.includes("user already exists")
  ) {
    return "account_exists";
  }

  return "signin_failed";
}
