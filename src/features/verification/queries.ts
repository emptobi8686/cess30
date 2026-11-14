import { requireUserSession } from "@/lib/supabase/auth";
import { getCurrentUserRole } from "@/lib/supabase/role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type VerificationSubmission = {
  id: string;
  full_name: string;
  matric_number: string | null;
  department: string;
  level: string;
  avatar_url: string | null;
  verification_status: "pending" | "verified" | "rejected" | "suspended";
  verification_reviewed_at: string | null;
  verification_reviewed_by: string | null;
  verification_rejection_reason: string | null;
  created_at: string;
};

export async function getVerificationQueue(options?: {
  status?: string;
  search?: string;
}) {
  const user = await requireUserSession();
  const role = await getCurrentUserRole();

  if (role !== "admin") {
    throw new Error("Administrator access required.");
  }

  const supabase = await createServerSupabaseClient();
  const selectedStatus = options?.status && options.status !== "all" ? options.status : "all";
  const searchQuery = options?.search?.trim() ?? "";

  let query = supabase
    .from("profiles")
    .select(
      "id, full_name, matric_number, department, level, avatar_url, verification_status, verification_reviewed_at, verification_reviewed_by, verification_rejection_reason, created_at"
    )
    .order("created_at", { ascending: false });

  if (selectedStatus !== "all") {
    query = query.eq("verification_status", selectedStatus);
  }

  if (searchQuery) {
    query = query.or(
      `full_name.ilike.%${searchQuery}%,matric_number.ilike.%${searchQuery}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const counts = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "verified"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "rejected"),
  ]);

  void user;

  return {
    items: (data ?? []) as VerificationSubmission[],
    counts: {
      pending: counts[0].count ?? 0,
      verified: counts[1].count ?? 0,
      rejected: counts[2].count ?? 0,
    },
  };
}
