import "server-only";

import { AUDIENCE_SELECT } from "@/features/audiences/schema";
import { requireStaff } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type LibraryResourceRow = {
  id: string;
  title: string;
  description: string | null;
  resource_type: string;
  course_id: string | null;
  level_code: string | null;
  status: string;
  current_file_id: string | null;
  copyright_basis: string;
  licence_note: string | null;
  tags: string[];
  created_at: string;
  published_at: string | null;
  removal_reason: string | null;
  courses?: { course_code: string; course_title: string } | null;
  library_resource_audiences?: Array<{ audience_kind: string; level_code: string | null; course_id: string | null; offering_id: string | null }>;
};

const RESOURCE_SELECT = `id, title, description, resource_type, course_id, level_code, status, current_file_id, copyright_basis,
  licence_note, tags, created_at, published_at, removal_reason, courses ( course_code, course_title ),
  library_resource_audiences ( ${AUDIENCE_SELECT} )`;

/** Staff list by status: admins see all; course reps see what they manage (not what they read as students). */
export async function getLibraryAdminList(status: string): Promise<LibraryResourceRow[]> {
  const access = await requireStaff();
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("library_resources").select(RESOURCE_SELECT).eq("status", status).order("created_at", { ascending: false });
  if (!access.isAdmin) {
    const { data: ids } = await supabase.rpc("managed_library_resource_ids");
    query = query.in("id", ((ids ?? []) as unknown as string[]).filter(Boolean));
  }
  const { data, error } = await query;
  if (error) throw new Error("Could not load library resources.");
  return (data ?? []) as unknown as LibraryResourceRow[];
}

export type LibraryFileRow = {
  id: string;
  version: number;
  mime_type: string | null;
  size_bytes: number | null;
  original_filename: string;
  scan_status: string;
  created_at: string;
};

export async function getLibraryResourceAdmin(id: string): Promise<{ resource: LibraryResourceRow; files: LibraryFileRow[] } | null> {
  await requireStaff();
  const supabase = await createServerSupabaseClient();
  const { data: manage } = await supabase.rpc("can_manage_library_resource", { p_id: id });
  if (manage !== true) return null;
  const [{ data: resource }, { data: files }] = await Promise.all([
    supabase.from("library_resources").select(RESOURCE_SELECT).eq("id", id).maybeSingle(),
    supabase.from("library_files").select("id, version, mime_type, size_bytes, original_filename, scan_status, created_at")
      .eq("resource_id", id).order("version", { ascending: false }),
  ]);
  if (!resource) return null;
  return { resource: resource as unknown as LibraryResourceRow, files: (files ?? []) as LibraryFileRow[] };
}

export type LibraryReportRow = {
  id: string;
  resource_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  library_resources: { title: string } | null;
};

export async function getOpenLibraryReports(): Promise<LibraryReportRow[]> {
  await requireStaff();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("library_reports")
    .select("id, resource_id, reason, details, status, created_at, library_resources ( title )")
    .eq("status", "open")
    .order("created_at", { ascending: true });
  if (error) throw new Error("Could not load reports.");
  return (data ?? []) as unknown as LibraryReportRow[];
}
