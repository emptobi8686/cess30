import { requireAdmin } from "@/lib/auth/guards";
import { buildVerificationSearchFilter } from "@/lib/postgrest";
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

export const VERIFICATION_PAGE_SIZE = 50;

const QUEUE_STATUSES = ["pending", "verified", "rejected", "suspended"] as const;

export async function getVerificationQueue(options?: {
  status?: string;
  search?: string;
  page?: number;
}) {
  await requireAdmin();

  const supabase = await createServerSupabaseClient();
  const selectedStatus = QUEUE_STATUSES.includes(options?.status as (typeof QUEUE_STATUSES)[number])
    ? (options?.status as string)
    : "all";
  const page = Math.max(1, Math.floor(options?.page ?? 1));
  const from = (page - 1) * VERIFICATION_PAGE_SIZE;
  const searchQuery = options?.search?.trim() ?? "";

  let query = supabase
    .from("profiles")
    .select(
      "id, full_name, matric_number, department, level, avatar_url, verification_status, verification_reviewed_at, verification_reviewed_by, verification_rejection_reason, created_at"
    )
    .order("created_at", { ascending: false })
    .range(from, from + VERIFICATION_PAGE_SIZE);

  if (selectedStatus !== "all") {
    query = query.eq("verification_status", selectedStatus);
  }

  const searchFilter = buildVerificationSearchFilter(searchQuery);
  if (searchFilter) {
    query = query.or(searchFilter);
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

  return {
    items: ((data ?? []) as VerificationSubmission[]).slice(0, VERIFICATION_PAGE_SIZE),
    page,
    hasNextPage: (data?.length ?? 0) > VERIFICATION_PAGE_SIZE,
    counts: {
      pending: counts[0].count ?? 0,
      verified: counts[1].count ?? 0,
      rejected: counts[2].count ?? 0,
    },
  };
}
