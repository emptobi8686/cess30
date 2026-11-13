/**
 * Password-change validation shared by the recovery UI and the server action.
 *
 * Supabase enforces its own password policy server-side; these checks provide
 * immediate, consistent feedback before the request is sent.
 */

export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(
  password: string,
  confirmPassword: string
): string | null {
  if (password.length === 0) return "New password is required.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (confirmPassword.length === 0) return "Please confirm your new password.";
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
}
