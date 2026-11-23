"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import {
  describeConflicts,
  findSessionConflicts,
  validateSessionInput,
  type SessionConflict,
} from "@/features/timetable/validation";
import type { ActionResult } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type ConflictRow = {
  id: string;
  course_id: string;
  lecture_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  is_cancelled: boolean;
  courses?: { course_code: string }[] | { course_code: string } | null;
};

function courseCodeFromRow(row: ConflictRow): string | null {
  if (!row.courses) return null;
  if (Array.isArray(row.courses)) return row.courses[0]?.course_code ?? null;
  return row.courses.course_code ?? null;
}

async function fetchConflictsForDate(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  lectureDate: string
): Promise<SessionConflict[]> {
  const { data, error } = await supabase
    .from("lecture_sessions")
    .select("id, course_id, lecture_date, start_time, end_time, venue, is_cancelled, courses(course_code)")
    .eq("lecture_date", lectureDate);

  if (error) throw new Error(error.message);

  return ((data ?? []) as ConflictRow[]).map((row) => ({
    id: row.id,
    course_id: row.course_id,
    lecture_date: row.lecture_date,
    start_time: row.start_time,
    end_time: row.end_time,
    venue: row.venue,
    is_cancelled: row.is_cancelled,
    course_code: courseCodeFromRow(row),
  }));
}

function revalidateTimetable() {
  revalidatePath("/timetable");
  revalidatePath("/admin/timetable");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

/**
 * Shared create/update conflict handling.
 * Duplicates and course overlaps are hard errors. Venue overlaps are soft and
 * may be forced by an administrator who knows the venue is shared.
 */
function conflictError(
  conflicts: ReturnType<typeof findSessionConflicts>,
  force: boolean
): string | null {
  if (conflicts.duplicates.length > 0) {
    return "An identical session already exists for this course, date and time.";
  }

  if (conflicts.courseOverlaps.length > 0) {
    return `This course already has an overlapping session: ${describeConflicts(
      conflicts.courseOverlaps
    )}.`;
  }

  if (!force && conflicts.venueOverlaps.length > 0) {
    return `VENUE_CONFLICT:This venue already has overlapping sessions: ${describeConflicts(
      conflicts.venueOverlaps
    )}. Submit again with force=true to save anyway.`;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create lecture session
// ─────────────────────────────────────────────────────────────────────────────

export async function createLectureSession(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdmin();
    const supabase = await createServerSupabaseClient();

    const course_id = String(formData.get("course_id") ?? "").trim();
    const lecture_date = String(formData.get("lecture_date") ?? "").trim();
    const start_time = String(formData.get("start_time") ?? "").trim();
    const end_time = String(formData.get("end_time") ?? "").trim();
    const venue = String(formData.get("venue") ?? "").trim();
    const lecturer_name = String(formData.get("lecturer_name") ?? "").trim() || null;
    // force=true lets an admin save despite a venue conflict (e.g. shared spaces)
    const force = formData.get("force") === "true";

    const inputError = validateSessionInput({
      course_id,
      lecture_date,
      start_time,
      end_time,
      venue,
    });
    if (inputError) return { ok: false, error: inputError };

    const existing = await fetchConflictsForDate(supabase, lecture_date);
    const conflicts = findSessionConflicts(
      { course_id, lecture_date, start_time, end_time, venue },
      existing
    );

    const conflict = conflictError(conflicts, force);
    if (conflict) return { ok: false, error: conflict };

    const { data, error } = await supabase
      .from("lecture_sessions")
      .insert({
        course_id,
        lecture_date,
        start_time,
        end_time,
        venue,
        lecturer_name,
        created_by: user.userId,
        updated_by: user.userId,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    revalidateTimetable();
    return { ok: true, data: { id: data.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update lecture session (also used for rescheduling)
// ─────────────────────────────────────────────────────────────────────────────

export async function updateLectureSession(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const supabase = await createServerSupabaseClient();

    const course_id = String(formData.get("course_id") ?? "").trim();
    const lecture_date = String(formData.get("lecture_date") ?? "").trim();
    const start_time = String(formData.get("start_time") ?? "").trim();
    const end_time = String(formData.get("end_time") ?? "").trim();
    const venue = String(formData.get("venue") ?? "").trim();
    const lecturer_name = String(formData.get("lecturer_name") ?? "").trim() || null;
    const force = formData.get("force") === "true";

    const inputError = validateSessionInput({
      course_id,
      lecture_date,
      start_time,
      end_time,
      venue,
    });
    if (inputError) return { ok: false, error: inputError };

    const existing = await fetchConflictsForDate(supabase, lecture_date);
    const conflicts = findSessionConflicts(
      { id, course_id, lecture_date, start_time, end_time, venue },
      existing
    );

    const conflict = conflictError(conflicts, force);
    if (conflict) return { ok: false, error: conflict };

    const { data, error } = await supabase
      .from("lecture_sessions")
      .update({
        course_id,
        lecture_date,
        start_time,
        end_time,
        venue,
        lecturer_name,
        updated_by: user.userId,
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Session not found or you do not have permission to edit it." };

    revalidateTimetable();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancel / restore session
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelLectureSession(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("lecture_sessions")
      .update({
        is_cancelled: true,
        cancelled_at: new Date().toISOString(),
        updated_by: user.userId,
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Session not found or you do not have permission to cancel it." };

    revalidateTimetable();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

export async function restoreLectureSession(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const supabase = await createServerSupabaseClient();

    // Restoring must not create a duplicate active slot. Fetch the row first so
    // the admin gets a clear error instead of a raw unique-index violation.
    const { data: session, error: fetchError } = await supabase
      .from("lecture_sessions")
      .select("id, course_id, lecture_date, start_time, end_time, venue, is_cancelled")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) return { ok: false, error: fetchError.message };
    if (!session) return { ok: false, error: "Session not found." };

    const existing = await fetchConflictsForDate(supabase, session.lecture_date);
    const conflicts = findSessionConflicts(
      {
        id: session.id,
        course_id: session.course_id,
        lecture_date: session.lecture_date,
        start_time: session.start_time,
        end_time: session.end_time,
        venue: session.venue,
      },
      existing
    );

    if (conflicts.duplicates.length > 0) {
      return {
        ok: false,
        error: "Cannot restore: an active session already exists for this course, date and time.",
      };
    }

    const { data, error } = await supabase
      .from("lecture_sessions")
      .update({
        is_cancelled: false,
        cancelled_at: null,
        updated_by: user.userId,
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Session not found or you do not have permission to restore it." };

    revalidateTimetable();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete session (destructive — admin only, requires explicit confirmation in UI)
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteLectureSession(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("lecture_sessions")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Session not found or you do not have permission to delete it." };

    revalidateTimetable();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}
