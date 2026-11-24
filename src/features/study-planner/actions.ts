"use server";

import { actionError } from "@/lib/errors";
import { guardStudentAction } from "@/lib/auth/guards";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  validateStudyDate,
  validateStudyTimeRange,
  generateRecurringDates,
  detectConflicts,
  VALID_REMINDERS,
  VALID_PATTERNS,
  firstSchemaIssue,
  studySessionSchema,
  studySessionUpdateSchema,
} from "@/features/study-planner/validation";
import type {
  ActionResult,
  ReminderPreference,
  RecurrencePattern,
  StudySession,
  LectureSession,
} from "@/types";

/**
 * Server Action: Create a new personal study session (or recurring series).
 */
export async function createStudySession(
  formData: FormData
): Promise<ActionResult<{ id: string; warnings?: string[] }>> {
  const access = await guardStudentAction("full");
  if (!access.ok) return access;
  const user = { id: access.ctx.userId };

  const title = (formData.get("title") as string)?.trim();
  const rawCourseId = (formData.get("course_id") as string)?.trim();
  const courseId = rawCourseId && rawCourseId !== "none" ? rawCourseId : null;
  const studyDate = (formData.get("study_date") as string)?.trim();
  const startTime = (formData.get("start_time") as string)?.trim();
  const endTime = (formData.get("end_time") as string)?.trim();
  const notes = ((formData.get("notes") as string)?.trim()) || null;
  const location = ((formData.get("location") as string)?.trim()) || null;

  const rawReminder = (formData.get("reminder_preference") as string)?.trim();
  const reminderPreference: ReminderPreference = VALID_REMINDERS.includes(
    rawReminder as ReminderPreference
  )
    ? (rawReminder as ReminderPreference)
    : "15_min";

  const rawPattern = (formData.get("recurrence_pattern") as string)?.trim();
  const recurrencePattern: RecurrencePattern | null = VALID_PATTERNS.includes(
    rawPattern as RecurrencePattern
  )
    ? (rawPattern as RecurrencePattern)
    : null;

  const recurrenceEndDate = ((formData.get("recurrence_end_date") as string)?.trim()) || null;

  const rawWeekdays = formData.getAll("selected_weekdays") as string[];
  const selectedWeekdays = rawWeekdays.map(Number).filter((n) => !isNaN(n));

  // Validations
  if (!title) {
    return { ok: false, error: "Study goal/title is required." };
  }
  if (title.length > 150) {
    return { ok: false, error: "Study title cannot exceed 150 characters." };
  }

  const parsedCreate = studySessionSchema.safeParse({
    title,
    study_date: studyDate ?? "",
    start_time: startTime ?? "",
    end_time: endTime ?? "",
    notes,
    location,
    course_id: courseId ?? "",
  });
  if (!parsedCreate.success) return { ok: false, error: firstSchemaIssue(parsedCreate.error) };

  const dateError = validateStudyDate(studyDate);
  if (dateError) return { ok: false, error: dateError };

  const timeError = validateStudyTimeRange(startTime, endTime);
  if (timeError) return { ok: false, error: timeError };

  const supabase = await createServerSupabaseClient();

  // Conflict detection for the initial study date
  const warnings: string[] = [];
  try {
    const [{ data: existingStudy }, { data: existingLectures }] = await Promise.all([
      supabase
        .from("study_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("study_date", studyDate),
      supabase
        .from("lecture_sessions")
        .select("*, courses ( course_code )")
        .eq("lecture_date", studyDate)
        .eq("is_cancelled", false),
    ]);

    const { studyConflicts, lectureConflicts } = detectConflicts(
      studyDate,
      startTime,
      endTime,
      (existingStudy ?? []) as StudySession[],
      (existingLectures ?? []) as LectureSession[]
    );

    if (studyConflicts.length > 0) {
      warnings.push(
        `Overlaps with ${studyConflicts.length} existing study session(s) on ${studyDate} (${studyConflicts.map((s) => s.title).join(", ")})`
      );
    }

    if (lectureConflicts.length > 0) {
      warnings.push(
        `Overlaps with ${lectureConflicts.length} official lecture(s) on ${studyDate}`
      );
    }
  } catch {
    // Conflict detection warning is non-blocking
  }

  // Handle recurring series or single session
  if (recurrencePattern && recurrenceEndDate) {
    const endError = validateStudyDate(recurrenceEndDate);
    if (endError) return { ok: false, error: `Recurrence end date error: ${endError}` };

    if (recurrenceEndDate <= studyDate) {
      return { ok: false, error: "Recurrence end date must be after the start date." };
    }

    const recurringDates = generateRecurringDates(
      studyDate,
      recurrenceEndDate,
      recurrencePattern,
      selectedWeekdays
    );

    const recurrenceId = crypto.randomUUID();

    const insertRows = recurringDates.map((date) => ({
      user_id: user.id,
      course_id: courseId,
      title,
      study_date: date,
      start_time: startTime,
      end_time: endTime,
      notes,
      location,
      reminder_preference: reminderPreference,
      completed: false,
      recurrence_id: recurrenceId,
      recurrence_pattern: recurrencePattern,
      recurrence_end_date: recurrenceEndDate,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("study_sessions")
      .insert(insertRows)
      .select("id")
      .limit(1)
      .single();

    if (insertError) {
      return actionError("study-planner", insertError, "study");
    }

    revalidatePath("/study-planner");
    revalidatePath("/dashboard");

    return {
      ok: true,
      data: {
        id: inserted?.id ?? recurrenceId,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    };
  }

  // Single non-recurring session
  const { data: singleInsert, error: singleError } = await supabase
    .from("study_sessions")
    .insert({
      user_id: user.id,
      course_id: courseId,
      title,
      study_date: studyDate,
      start_time: startTime,
      end_time: endTime,
      notes,
      location,
      reminder_preference: reminderPreference,
      completed: false,
      recurrence_id: null,
      recurrence_pattern: null,
      recurrence_end_date: null,
    })
    .select("id")
    .single();

  if (singleError) {
    return actionError("study-planner", singleError, "study");
  }

  revalidatePath("/study-planner");
  revalidatePath("/dashboard");

  return {
    ok: true,
    data: {
      id: singleInsert.id,
      warnings: warnings.length > 0 ? warnings : undefined,
    },
  };
}

/**
 * Server Action: Update a study session (single or recurring series).
 */
export async function updateStudySession(
  sessionId: string,
  formData: FormData,
  updateEntireSeries = false
): Promise<ActionResult> {
  const access = await guardStudentAction("full");
  if (!access.ok) return access;
  const user = { id: access.ctx.userId };
  const supabase = await createServerSupabaseClient();

  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from("study_sessions")
    .select("id, user_id, recurrence_id")
    .eq("id", sessionId)
    .single();

  if (fetchError || !existing || existing.user_id !== user.id) {
    return { ok: false, error: "Study session not found or unauthorized." };
  }

  const title = (formData.get("title") as string)?.trim();
  const rawCourseId = (formData.get("course_id") as string)?.trim();
  const courseId = rawCourseId && rawCourseId !== "none" ? rawCourseId : null;
  const studyDate = (formData.get("study_date") as string)?.trim();
  const startTime = (formData.get("start_time") as string)?.trim();
  const endTime = (formData.get("end_time") as string)?.trim();
  const notes = ((formData.get("notes") as string)?.trim()) || null;
  const location = ((formData.get("location") as string)?.trim()) || null;

  const rawReminder = (formData.get("reminder_preference") as string)?.trim();
  const reminderPreference: ReminderPreference = VALID_REMINDERS.includes(
    rawReminder as ReminderPreference
  )
    ? (rawReminder as ReminderPreference)
    : "15_min";

  const parsedUpdate = studySessionUpdateSchema.safeParse({
    title: title ?? "",
    start_time: startTime ?? "",
    end_time: endTime ?? "",
    notes,
    location,
    course_id: courseId ?? "",
  });
  if (!parsedUpdate.success) return { ok: false, error: firstSchemaIssue(parsedUpdate.error) };

  if (updateEntireSeries && existing.recurrence_id) {
    // Update all sessions in the series (preserving their individual dates)
    const { error: updateSeriesError } = await supabase
      .from("study_sessions")
      .update({
        title,
        course_id: courseId,
        start_time: startTime,
        end_time: endTime,
        notes,
        location,
        reminder_preference: reminderPreference,
      })
      .eq("recurrence_id", existing.recurrence_id)
      .eq("user_id", user.id);

    if (updateSeriesError) return actionError("study-planner", updateSeriesError, "study");
  } else {
    // Single session update
    const dateError = validateStudyDate(studyDate);
    if (dateError) return { ok: false, error: dateError };

    const { error: updateError } = await supabase
      .from("study_sessions")
      .update({
        title,
        course_id: courseId,
        study_date: studyDate,
        start_time: startTime,
        end_time: endTime,
        notes,
        location,
        reminder_preference: reminderPreference,
      })
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (updateError) return actionError("study-planner", updateError, "study");
  }

  revalidatePath("/study-planner");
  revalidatePath("/dashboard");

  return { ok: true, data: undefined };
}

/**
 * Server Action: Delete a study session (single or recurring series).
 */
export async function deleteStudySession(
  sessionId: string,
  deleteEntireSeries = false
): Promise<ActionResult> {
  const access = await guardStudentAction("full");
  if (!access.ok) return access;
  const user = { id: access.ctx.userId };
  const supabase = await createServerSupabaseClient();

  const { data: existing, error: fetchError } = await supabase
    .from("study_sessions")
    .select("id, user_id, recurrence_id")
    .eq("id", sessionId)
    .single();

  if (fetchError || !existing || existing.user_id !== user.id) {
    return { ok: false, error: "Study session not found or unauthorized." };
  }

  if (deleteEntireSeries && existing.recurrence_id) {
    const { error: deleteError } = await supabase
      .from("study_sessions")
      .delete()
      .eq("recurrence_id", existing.recurrence_id)
      .eq("user_id", user.id);

    if (deleteError) return actionError("study-planner", deleteError, "study");
  } else {
    const { error: deleteError } = await supabase
      .from("study_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (deleteError) return actionError("study-planner", deleteError, "study");
  }

  revalidatePath("/study-planner");
  revalidatePath("/dashboard");

  return { ok: true, data: undefined };
}

/**
 * Server Action: Mark session as completed or uncompleted.
 */
export async function toggleStudySessionCompleted(
  sessionId: string,
  completed: boolean
): Promise<ActionResult> {
  const access = await guardStudentAction("full");
  if (!access.ok) return access;
  const user = { id: access.ctx.userId };
  const supabase = await createServerSupabaseClient();

  const completedAt = completed ? new Date().toISOString() : null;

  const { data: updated, error } = await supabase
    .from("study_sessions")
    .update({
      completed,
      completed_at: completedAt,
    })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return actionError("study-planner", error, "study");
  if (!updated) return { ok: false, error: "Study session not found." };

  revalidatePath("/study-planner");
  revalidatePath("/dashboard");

  return { ok: true, data: undefined };
}

/**
 * Server Action: Reschedule a study session date and time.
 */
export async function rescheduleStudySession(
  sessionId: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string
): Promise<ActionResult> {
  const access = await guardStudentAction("full");
  if (!access.ok) return access;
  const user = { id: access.ctx.userId };
  const supabase = await createServerSupabaseClient();

  const dateError = validateStudyDate(newDate);
  if (dateError) return { ok: false, error: dateError };

  const timeError = validateStudyTimeRange(newStartTime, newEndTime);
  if (timeError) return { ok: false, error: timeError };

  const { data: updated, error } = await supabase
    .from("study_sessions")
    .update({
      study_date: newDate,
      start_time: newStartTime,
      end_time: newEndTime,
    })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return actionError("study-planner", error, "study");
  if (!updated) return { ok: false, error: "Study session not found." };

  revalidatePath("/study-planner");
  revalidatePath("/dashboard");

  return { ok: true, data: undefined };
}

