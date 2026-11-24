import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AudienceInput } from "./schema";

export type AudienceOption = { id: string; label: string; level: string; courseId?: string };
export type AudienceOptions = { courses: AudienceOption[]; offerings: AudienceOption[] };

/** Targets for the audience picker: catalogue courses and the current semester's offerings. */
export async function getAudienceOptions(): Promise<AudienceOptions> {
  const supabase = await createServerSupabaseClient();
  const [{ data: courses }, { data: offerings }] = await Promise.all([
    supabase.from("courses").select("id, course_code, course_title, level").is("archived_at", null).order("course_code"),
    supabase
      .from("course_offerings")
      .select("id, course_id, level_code, status, courses ( course_code ), semesters!inner ( is_current )")
      .eq("semesters.is_current", true)
      .neq("status", "cancelled"),
  ]);
  return {
    courses: (courses ?? []).map((c) => ({ id: c.id, label: `${c.course_code} — ${c.course_title}`, level: c.level })),
    offerings: ((offerings ?? []) as unknown as Array<{ id: string; course_id: string; level_code: string; courses: { course_code: string } | null }>)
      .map((o) => ({ id: o.id, courseId: o.course_id, label: `${o.courses?.course_code ?? "Course"} · Level ${o.level_code}`, level: o.level_code }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}

const SAFE = ["You cannot target that audience.", "You cannot change who sees this.", "Give at most 20 audiences."];

/** Replaces an item's audiences through the replace_audiences RPC (scope-checked in the database). */
export async function saveAudiences(
  table: "announcement_audiences" | "quest_audiences" | "library_resource_audiences",
  ownerId: string,
  audiences: AudienceInput[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("replace_audiences", { p_table: table, p_owner: ownerId, p_rows: audiences });
  if (error) {
    return { ok: false, error: error.message && SAFE.includes(error.message) ? error.message : "Who sees this could not be saved." };
  }
  return { ok: true };
}
