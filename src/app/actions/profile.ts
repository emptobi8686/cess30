"use server";

import { logServerError, toUserError } from "@/lib/errors";
import { AVATAR_BUCKET, objectPathFromPublicUrl } from "@/features/profile/avatar";
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
 * Server Action: record a profile picture that the browser uploaded directly to
 * Storage (avoids the 1 MB server-action body limit). The path must be inside the
 * caller's own folder; the previous picture in that folder is removed.
 */
export async function setAvatarAction(path: string): Promise<CompleteProfileState> {
  const user = await requireUserSession();
  if (typeof path !== "string" || !path.startsWith(`${user.id}/`) || path.includes("..")) {
    return { error: "Invalid profile picture." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: profile } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
    const previousPath = profile?.avatar_url ? objectPathFromPublicUrl(profile.avatar_url, AVATAR_BUCKET) : null;

    const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", user.id);

    if (updateError) {
      logServerError("profile.setAvatar", updateError);
      await supabase.storage.from(AVATAR_BUCKET).remove([path]);
      return { error: toUserError(updateError, "profile") };
    }

    if (previousPath && previousPath !== path && previousPath.startsWith(`${user.id}/`)) {
      const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]);
      if (removeError) logServerError("profile.setAvatar.cleanup", removeError);
    }

    revalidatePath("/settings/profile");
    revalidatePath("/dashboard");
    return { success: "Profile picture updated." };
  } catch (error) {
    logServerError("profile.setAvatar", error);
    return { error: "Unable to update profile picture. Please try again." };
  }
}

/**
 * Server Action: remove the profile picture. Clears avatar_url even when the URL is
 * not one of our Storage objects (e.g. a legacy external picture).
 */
export async function deleteProfilePicture(): Promise<CompleteProfileState> {
  const user = await requireUserSession();

  try {
    const supabase = await createServerSupabaseClient();
    const { data: profile } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
    if (!profile?.avatar_url) return { error: "No profile picture to delete." };

    const objectPath = objectPathFromPublicUrl(profile.avatar_url, AVATAR_BUCKET);
    if (objectPath && objectPath.startsWith(`${user.id}/`)) {
      const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([objectPath]);
      if (removeError) logServerError("profile.deleteAvatar", removeError);
    }

    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    if (updateError) {
      logServerError("profile.deleteAvatar", updateError);
      return { error: toUserError(updateError, "profile") };
    }

    revalidatePath("/settings/profile");
    revalidatePath("/dashboard");
    return { success: "Profile picture removed." };
  } catch (error) {
    logServerError("profile.deleteAvatar", error);
    return { error: "Unable to delete profile picture. Please try again." };
  }
}
