"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { guardStudentAction } from "@/lib/auth/guards";
import {
  errorState,
  rpcErrorToMessage,
  successState,
  type ActionState,
} from "@/features/verification/action-state";

/** Rejected students correct (or confirm) their matriculation number and return to review. */
export async function requestReverificationAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const access = await guardStudentAction("read");
  if (!access.ok) return errorState(access.error);

  const matric = String(formData.get("matricNumber") ?? "").trim();
  if (!/^[A-Za-z0-9/_-]{6,15}$/.test(matric)) {
    return errorState("Enter a valid matriculation number.");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("request_reverification", { p_matric_number: matric });
  if (error) return errorState(rpcErrorToMessage(error));

  revalidatePath("/dashboard");
  revalidatePath("/settings/profile");
  return successState("Resubmitted. Your profile is pending administrator review.");
}
