import "server-only";

import { AUDIENCE_SELECT } from "@/features/audiences/schema";
import { requireStaff } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type TutorialRow = {
  id: string;
  title: string;
  description: string | null;
  topic: string;
  course_id: string | null;
  level_code: string | null;
  source_type: string;
  provider: "youtube" | "vimeo" | "other_allowlisted";
  provider_video_id: string | null;
  external_url: string;
  embed_allowed: boolean;
  creator_name: string | null;
  provider_name: string | null;
  duration_seconds: number | null;
  learning_objectives: string[];
  status: string;
  review_status: string;
  is_ai_generated: boolean;
  ai_tool: string | null;
  ai_disclosure: string | null;
  academic_reviewer_id: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  link_status: string;
  created_by: string;
  published_at: string | null;
  tutorial_audiences?: Array<{ audience_kind: string; level_code: string | null; course_id: string | null; offering_id: string | null }>;
};

export const TUTORIAL_SELECT = `id, title, description, topic, course_id, level_code, source_type, provider, provider_video_id, external_url,
  embed_allowed, creator_name, provider_name, duration_seconds, learning_objectives, status, review_status, is_ai_generated, ai_tool,
  ai_disclosure, academic_reviewer_id, reviewed_at, review_notes, link_status, created_by, published_at,
  tutorial_audiences ( ${AUDIENCE_SELECT} )`;

export async function getTutorialAdminList(tab: string): Promise<TutorialRow[]> {
  const access = await requireStaff();
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("tutorials").select(TUTORIAL_SELECT).order("created_at", { ascending: false });
  if (tab === "links") query = query.in("link_status", ["broken", "unavailable_embed"]);
  else query = query.eq("status", tab);
  if (!access.isAdmin) {
    const { data: ids } = await supabase.rpc("managed_tutorial_ids");
    query = query.in("id", ((ids ?? []) as unknown as string[]).filter(Boolean));
  }
  const { data, error } = await query;
  if (error) throw new Error("Could not load tutorials.");
  return (data ?? []) as unknown as TutorialRow[];
}

export async function getTutorialAdmin(id: string): Promise<{ tutorial: TutorialRow; reviewerName: string | null; userId: string } | null> {
  const access = await requireStaff();
  const supabase = await createServerSupabaseClient();
  const { data: manage } = await supabase.rpc("can_manage_tutorial", { p_id: id });
  if (manage !== true) return null;
  const { data } = await supabase.from("tutorials").select(TUTORIAL_SELECT).eq("id", id).maybeSingle();
  if (!data) return null;
  const tutorial = data as unknown as TutorialRow;
  return { tutorial, reviewerName: await reviewerName(tutorial.academic_reviewer_id), userId: access.userId };
}

/** Reviewer display name via the service role (reviewer profiles are not readable by every staff member). */
export async function reviewerName(id: string | null): Promise<string | null> {
  if (!id) return null;
  const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");
  const { data } = await createAdminSupabaseClient().from("profiles").select("full_name").eq("id", id).maybeSingle();
  return data?.full_name ?? null;
}

export async function getOpenTutorialReports() {
  await requireStaff();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("tutorial_reports")
    .select("id, tutorial_id, reason, details, created_at, tutorials ( title )")
    .eq("status", "open").order("created_at");
  if (error) throw new Error("Could not load reports.");
  return (data ?? []) as unknown as Array<{ id: string; tutorial_id: string; reason: string; details: string | null; tutorials: { title: string } | null }>;
}
