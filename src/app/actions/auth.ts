"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateNewPassword } from "@/lib/password";

export type UpdatePasswordState = { error: string } | null;

/**
 * Server Action: sign the current user out and redirect to the login page.
 * Called from the dashboard shell sign-out button.
 */
export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Server Action: set a new password for the authenticated recovery session.
 *
 * The recovery link is verified by /auth/confirm (or by the client-side code
 * exchange on /reset-password/update), so this action only accepts a request
 * that already has a valid Supabase session. After a successful update the
 * session is signed out and the user is redirected to login.
 */
export async function updatePassword(
  _previousState: UpdatePasswordState,
  formData: FormData
): Promise<UpdatePasswordState> {
  const passwordEntry = formData.get("password");
  const confirmPasswordEntry = formData.get("confirmPassword");
  const password = typeof passwordEntry === "string" ? passwordEntry : "";
  const confirmPassword =
    typeof confirmPasswordEntry === "string" ? confirmPasswordEntry : "";

  const validationError = validateNewPassword(password, confirmPassword);

  if (validationError) {
    return { error: validationError };
  }

  try {
    const supabase = await createServerSupabaseClient();

    // Verify the recovery session against the auth server before mutating.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        error: "Your recovery session has expired. Request a new password reset link.",
      };
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return { error: error.message };
    }

    await supabase.auth.signOut();
  } catch {
    return {
      error: "Unable to update your password right now. Please try again.",
    };
  }

  redirect("/login?message=password_updated");
}
