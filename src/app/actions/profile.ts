"use server";

import { logServerError, toUserError } from "@/lib/errors";
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

    const { error } = await supabase
      .from("profiles")
      .update({ matric_number: matricNumber })
      .eq("id", user.id);

    if (error) {
      logServerError("profile.submitMatricNumber", error);
      return { error: toUserError(error, "matric") };
    }

    revalidatePath("/dashboard");
    return { success: "Matriculation number saved. Your profile is pending administrator review." };
  } catch {
    return { error: "Unable to update profile. Please try again." };
  }
}

/**
 * Server Action: Update editable profile fields (nickname).
 *
 * Students may only change their nickname. Protected fields (verification_status,
 * department, level, id, created_at, matric_number once set) are guarded by the
 * prevent_profile_identity_changes trigger and RLS.
 */
export async function updateProfile(
  _previousState: CompleteProfileState,
  formData: FormData
): Promise<CompleteProfileState> {
  const user = await requireUserSession();
  const nickname = (formData.get("nickname") as string)?.trim();

  if (nickname !== undefined && nickname.length > 100) {
    return { error: "Nickname cannot exceed 100 characters." };
  }

  try {
    const supabase = await createServerSupabaseClient();

    const updates: Record<string, string | null> = {};
    if (nickname !== undefined) {
      updates.nickname = nickname || null;
    }

    if (Object.keys(updates).length === 0) {
      return { error: "No changes provided." };
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      logServerError("profile", error);
      return { error: toUserError(error, "profile") };
    }

    revalidatePath("/settings/profile");
    revalidatePath("/dashboard");
    return { success: "Profile updated successfully." };
  } catch {
    return { error: "Unable to update profile. Please try again." };
  }
}

/**
 * Server Action: Fetch the current user's profile.
 *
 * Used by the profile settings page to load profile data without importing
 * the server Supabase client directly in a page that also contains client
 * components.
 */
export async function getProfile(): Promise<{
  id: string;
  full_name: string;
  nickname: string | null;
  matric_number: string | null;
  department: string;
  level: string;
  avatar_url: string | null;
  verification_status: string;
  verification_reviewed_at: string | null;
  verification_reviewed_by: string | null;
  verification_rejection_reason: string | null;
  created_at: string;
  updated_at: string;
} | null> {
  const user = await requireUserSession();
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data ?? null;
}

/**
 * Server Action: Upload or replace a profile picture.
 *
 * The file is stored in the public `profile-pictures` bucket under
 * `profile-pictures/<userId>/<filename>`. Only the owning student may write.
 * Returns the public URL of the uploaded object.
 */
export async function uploadProfilePicture(
  _previousState: CompleteProfileState,
  formData: FormData
): Promise<CompleteProfileState> {
  const user = await requireUserSession();
  const file = formData.get("file") as File | null;

  if (!file) {
    return { error: "No file selected." };
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return { error: "Only JPEG, PNG, WebP, and GIF images are allowed." };
  }

  const maxBytes = 5 * 1024 * 1024; // 5 MB
  if (file.size > maxBytes) {
    return { error: "Profile picture must be smaller than 5 MB." };
  }

  try {
    const supabase = await createServerSupabaseClient();

    const fileExt = file.name.split(".").pop() ?? "jpg";
    const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-pictures")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      logServerError("profile", uploadError);
      return { error: "Unable to upload profile picture." };
    }

    const { data: urlData } = supabase.storage
      .from("profile-pictures")
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", user.id);

    if (updateError) {
      logServerError("profile", updateError);
      return { error: toUserError(updateError, "profile") };
    }

    revalidatePath("/settings/profile");
    revalidatePath("/dashboard");
    return { success: "Profile picture updated." };
  } catch {
    return { error: "Unable to upload profile picture. Please try again." };
  }
}

/**
 * Server Action: Delete the student's profile picture.
 */
export async function deleteProfilePicture(): Promise<CompleteProfileState> {
  const user = await requireUserSession();

  try {
    const supabase = await createServerSupabaseClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.avatar_url) {
      return { error: "No profile picture to delete." };
    }

    // Extract the object path from the public URL.
    const url = new URL(profile.avatar_url);
    const pathSegments = url.pathname.split("/");
    // Public URL format: .../storage/v1/object/public/profile-pictures/<path>
    const publicIndex = pathSegments.indexOf("public");
    if (publicIndex === -1 || publicIndex + 2 >= pathSegments.length) {
      return { error: "Unable to parse profile picture path." };
    }
    const bucket = pathSegments[publicIndex + 1]; // "profile-pictures"
    const objectPath = pathSegments.slice(publicIndex + 2).join("/");

    const { error: removeError } = await supabase.storage
      .from(bucket)
      .remove([objectPath]);

    if (removeError) {
      logServerError("profile", removeError);
      return { error: "Unable to delete profile picture." };
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);

    if (updateError) {
      logServerError("profile", updateError);
      return { error: toUserError(updateError, "profile") };
    }

    revalidatePath("/settings/profile");
    revalidatePath("/dashboard");
    return { success: "Profile picture removed." };
  } catch {
    return { error: "Unable to delete profile picture. Please try again." };
  }
}

