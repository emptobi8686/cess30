import "server-only";

import { AUDIENCE_SELECT } from "@/features/audiences/schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { LibraryResourceRow } from "./queries";

export type LibraryCard = Pick<LibraryResourceRow, "id" | "title" | "description" | "resource_type" | "course_id" | "level_code" | "tags" | "published_at"> & {
  courses?: { course_code: string; course_title: string } | null;
};

const CARD_SELECT = "id, title, description, resource_type, course_id, level_code, tags, published_at, courses ( course_code, course_title )";

/** Search through search_library (security invoker: RLS decides visibility). */
export async function searchLibrary(filters: { q: string; type: string | null; level: string | null; courseId: string | null }): Promise<LibraryCard[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("search_library", {
    p_query: filters.q,
    p_course_id: filters.courseId,
    p_level_code: filters.level,
    p_type: filters.type,
    p_limit: 50,
  });
  if (error) throw new Error("Could not search the library.");
  const rows = (data ?? []) as LibraryCard[];
  if (rows.length === 0) return [];
  const { data: courses } = await supabase.from("courses").select("id, course_code, course_title")
    .in("id", [...new Set(rows.map((r) => r.course_id).filter((v): v is string => Boolean(v)))]);
  const byId = new Map((courses ?? []).map((c) => [c.id, c]));
  return rows.map((r) => ({ ...r, courses: r.course_id ? byId.get(r.course_id) ?? null : null }));
}

export async function getMyBookmarks(userId: string): Promise<LibraryCard[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("library_bookmarks")
    .select(`created_at, library_resources!inner ( ${CARD_SELECT} )`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return ((data ?? []) as unknown as Array<{ library_resources: LibraryCard }>).map((b) => b.library_resources);
}

export type LibraryDetail = LibraryCard & {
  current_file_id: string | null;
  licence_note: string | null;
  copyright_basis: string;
  library_resource_audiences: LibraryResourceRow["library_resource_audiences"];
  mime_type: string | null;
};

export async function getLibraryResourceForStudent(id: string, userId: string): Promise<{ resource: LibraryDetail; bookmarked: boolean; related: LibraryCard[] } | null> {
  const supabase = await createServerSupabaseClient();
  const { data: resource } = await supabase
    .from("library_resources")
    .select(`${CARD_SELECT}, current_file_id, licence_note, copyright_basis, status, library_resource_audiences ( ${AUDIENCE_SELECT} )`)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (!resource) return null;
  const r = resource as unknown as LibraryDetail;

  // The file type decides whether an inline preview is offered (PDF only).
  let mime: string | null = null;
  if (r.current_file_id) {
    const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");
    const { data: file } = await createAdminSupabaseClient().from("library_files").select("mime_type").eq("id", r.current_file_id).maybeSingle();
    mime = file?.mime_type ?? null;
  }

  const [{ data: bookmark }, related] = await Promise.all([
    supabase.from("library_bookmarks").select("resource_id").eq("user_id", userId).eq("resource_id", id).maybeSingle(),
    relatedResources(r),
  ]);
  return { resource: { ...r, mime_type: mime }, bookmarked: Boolean(bookmark), related };
}

/** Same course first, then shared tags; everything through RLS; at most 6. */
async function relatedResources(r: LibraryCard): Promise<LibraryCard[]> {
  const supabase = await createServerSupabaseClient();
  const out: LibraryCard[] = [];
  if (r.course_id) {
    const { data } = await supabase.from("library_resources").select(CARD_SELECT)
      .eq("status", "published").eq("course_id", r.course_id).neq("id", r.id).limit(6);
    out.push(...((data ?? []) as unknown as LibraryCard[]));
  }
  if (out.length < 6 && r.tags.length) {
    const { data } = await supabase.from("library_resources").select(CARD_SELECT)
      .eq("status", "published").overlaps("tags", r.tags).neq("id", r.id).limit(6);
    for (const row of (data ?? []) as unknown as LibraryCard[]) if (!out.some((o) => o.id === row.id)) out.push(row);
  }
  return out.slice(0, 6);
}

/** Resources published in the last 14 days. */
export function recentlyAdded(items: LibraryCard[], now: number = Date.now()): LibraryCard[] {
  const since = now - 14 * 86_400_000;
  return items.filter((r) => r.published_at && Date.parse(r.published_at) >= since);
}
