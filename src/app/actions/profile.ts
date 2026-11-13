"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUserSession } from "@/lib/supabase/auth";

export type CompleteProfileState = {
  error?: string;
  success?: string;
} | null;

/**
 * Server Action: Submit matriculation number for a student account
 * (e.g., after registering via Google OAuth).
 *
 * Once saved, the trigger prevent_profile_identity_changes() protects
 * matric_number from further modifications by the student.
 */
export async function submitMatricNumber(
  _previousState: CompleteProfileState,
  formData: FormData
): Promise<CompleteProfileState> {
  const user = await requireUserSession();
  const rawMatric = formData.get("matricNumber");
  const matricNumber = typeof rawMatric === "string" ? rawMatric.trim() : "";

  if (!matricNumber) {
    return { error: "Please enter your UNILAG matriculation number." };
  }

  // Basic sanity validation for UNILAG matric numbers (alphanumeric, 7 to 12 chars)
  if (!/^[a-zA-Z0-9/_-]{6,15}$/.test(matricNumber)) {
    return {
      error: "Please enter a valid matriculation number format (e.g. 190408012).",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();

    // Check if matric number is already used by another student profile
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("matric_number", matricNumber)
      .neq("id", user.id)
      .maybeSingle();

    if (existing) {
      return {
        error: "This matriculation number is already registered to another account.",
      };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ matric_number: matricNumber })
      .eq("id", user.id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: "Matriculation number saved. Your profile is pending administrator review." };
  } catch {
    return { error: "Unable to update profile. Please try again." };
  }
}

