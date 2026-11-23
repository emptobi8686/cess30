import "server-only";

import { requireAdmin } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type StaffAssignmentRow = {
  id: string;
  user_id: string;
  capability: string;
  level_code: string | null;
  status: string;
  expires_at: string | null;
  granted_at: string;
  granted_by: string;
  reason: string;
  profiles: { full_name: string; matric_number: string | null } | null;
};

export async function getStaffAssignments(): Promise<StaffAssignmentRow[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("staff_assignments")
    .select("id, user_id, capability, level_code, status, expires_at, granted_at, granted_by, reason, profiles!staff_assignments_user_id_fkey ( full_name, matric_number )")
    .neq("status", "revoked")
    .order("granted_at", { ascending: false });
  if (error) throw new Error("Could not load staff assignments.");
  return (data ?? []) as unknown as StaffAssignmentRow[];
}
