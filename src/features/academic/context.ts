import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { toAcademicContext, type AcademicContext } from "@/features/academic/context-core";

export type { AcademicContext } from "@/features/academic/context-core";

/** Current session/semester labels, the viewer's placement, and their active enrolments. */
export async function getAcademicContext(): Promise<AcademicContext> {
  const supabase = await createServerSupabaseClient();
  try {
    const [{ data: ctxRows }, { data: enrolments }, { data: session }, { data: semester }] = await Promise.all([
      supabase.rpc("my_access_context"),
      supabase.from("course_enrollments").select("offering_id").eq("status", "active"),
      supabase.from("academic_sessions").select("label").eq("is_current", true).maybeSingle(),
      supabase.from("semesters").select("label").eq("is_current", true).maybeSingle(),
    ]);
    const row = Array.isArray(ctxRows) ? (ctxRows[0] ?? null) : null;
    return toAcademicContext(row, enrolments ?? [], {
      session: session?.label ?? null,
      semester: semester?.label ?? null,
    });
  } catch {
    // Academic structure not available yet (e.g. migrations pending): behave as "no placement".
    return toAcademicContext(null, [], null);
  }
}
