import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  addCalendarDays,
  getLagosDateAndTime,
  getReminderMinutes,
  lagosLocalTimeToUtc,
} from "@/lib/notifications/time";
import { getAnnouncementRecipients } from "@/lib/notifications/targeting";
import type {
  NotificationPreferences,
  NotificationSourceType,
  NotificationType,
} from "@/types";

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type ProfileRow = {
  id: string;
  department: string;
  level: string;
};

type PreferenceRow = Pick<
  NotificationPreferences,
  | "user_id"
  | "push_enabled"
  | "lecture_reminders_enabled"
  | "study_reminders_enabled"
  | "announcement_notifications_enabled"
  | "lecture_reminder_minutes"
  | "quiet_hours_enabled"
  | "quiet_hours_start"
  | "quiet_hours_end"
>;

type LectureRow = {
  id: string;
  lecture_date: string;
  start_time: string;
  is_cancelled: boolean;
  courses: Array<{
    course_code: string;
    department: string;
    level: string;
  }> | null;
};

type StudySessionRow = {
  id: string;
  user_id: string;
  title: string;
  study_date: string;
  start_time: string;
  reminder_preference: "none" | "15_min" | "30_min" | "1_hour" | "1_day";
  completed: boolean;
};

async function fetchAll<T>(
  loadPage: (from: number, to: number) => PromiseLike<QueryResult<T>>
) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await loadPage(from, from + 999);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function loadTargetingData() {
  const admin = createAdminSupabaseClient();
  const [profiles, preferences, adminRoles] = await Promise.all([
    fetchAll<ProfileRow>((from, to) =>
      admin
        .from("profiles")
        .select("id, department, level")
        .order("id")
        .range(from, to)
    ),
    fetchAll<PreferenceRow>((from, to) =>
      admin
        .from("notification_preferences")
        .select(
          "user_id, push_enabled, lecture_reminders_enabled, study_reminders_enabled, announcement_notifications_enabled, lecture_reminder_minutes, quiet_hours_enabled, quiet_hours_start, quiet_hours_end"
        )
        .order("user_id")
        .range(from, to)
    ),
    fetchAll<{ user_id: string }>((from, to) =>
      admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .order("user_id")
        .range(from, to)
    ),
  ]);
  const adminUserIds = new Set(adminRoles.map((role) => role.user_id));

  return {
    admin,
    profiles: profiles.filter((profile) => !adminUserIds.has(profile.id)),
    preferences: new Map(preferences.map((preference) => [preference.user_id, preference])),
  };
}

function buildReminderRow({
  userId,
  notificationType,
  sourceType,
  sourceId,
  title,
  message,
  actionUrl,
  dedupeKey,
  pushEnabled,
  expiresAt,
}: {
  userId: string;
  notificationType: NotificationType;
  sourceType: NotificationSourceType;
  sourceId: string;
  title: string;
  message: string;
  actionUrl: string;
  dedupeKey: string;
  pushEnabled: boolean;
  expiresAt: Date | null;
}) {
  return {
    user_id: userId,
    title,
    message,
    notification_type: notificationType,
    source_type: sourceType,
    source_id: sourceId,
    action_url: actionUrl,
    dedupe_key: dedupeKey,
    is_read: false,
    push_requested: pushEnabled,
    push_status: pushEnabled ? "pending" : "not_requested",
    push_expires_at: expiresAt?.toISOString() ?? null,
  };
}

async function insertNotifications(rows: ReturnType<typeof buildReminderRow>[]) {
  if (rows.length === 0) return 0;
  const admin = createAdminSupabaseClient();
  let insertedCount = 0;

  for (let offset = 0; offset < rows.length; offset += 500) {
    const batch = rows.slice(offset, offset + 500);
    const { data, error } = await admin
      .from("notifications")
      .upsert(batch, { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    insertedCount += data?.length ?? 0;
  }

  return insertedCount;
}

export async function enqueueAnnouncementNotifications(
  announcement: {
    id: string;
    title: string;
    scope: "all" | "department" | "level" | "course";
    course_id: string | null;
  },
  sendPush: boolean
) {
  const { admin, profiles, preferences } = await loadTargetingData();
  let courseAudience: { department: string; level: string } | null = null;
  if (announcement.scope === "course") {
    if (!announcement.course_id) {
      throw new Error("Course-scoped announcements require a course.");
    }
    const { data: course, error } = await admin
      .from("courses")
      .select("department, level")
      .eq("id", announcement.course_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!course) throw new Error("The announcement course could not be found.");
    courseAudience = course;
  }
  const eligibleProfiles = getAnnouncementRecipients(
    profiles,
    announcement.scope,
    courseAudience
  );

  const rows = eligibleProfiles.flatMap((profile) => {
    const preference = preferences.get(profile.id);
    if (!preference?.announcement_notifications_enabled) return [];

    const shouldPush = sendPush && preference.push_enabled;

    return [
      {
        ...buildReminderRow({
          userId: profile.id,
          notificationType: "announcement",
          sourceType: "announcement",
          sourceId: announcement.id,
          title: announcement.title.slice(0, 160),
          message: "A new academic announcement is available.",
          actionUrl: "/announcements",
          dedupeKey: `announcement:${announcement.id}:${profile.id}`,
          pushEnabled: shouldPush,
          expiresAt: null,
        }),
      },
    ];
  });

  return insertNotifications(rows);
}

export async function createDueReminderNotifications() {
  const admin = createAdminSupabaseClient();
  const { date: today } = getLagosDateAndTime(new Date());
  const now = new Date();
  const lastLectureDate = addCalendarDays(today, 1);
  const lastStudyDate = addCalendarDays(today, 2);
  const [targetingData, lectures, studies] = await Promise.all([
    loadTargetingData(),
    fetchAll<LectureRow>((from, to) =>
      admin
        .from("lecture_sessions")
        .select("id, lecture_date, start_time, is_cancelled, courses(course_code, department, level)")
        .eq("is_cancelled", false)
        .gte("lecture_date", today)
        .lte("lecture_date", lastLectureDate)
        .order("id")
        .range(from, to)
    ),
    fetchAll<StudySessionRow>((from, to) =>
      admin
        .from("study_sessions")
        .select("id, user_id, title, study_date, start_time, reminder_preference, completed")
        .eq("completed", false)
        .gte("study_date", today)
        .lte("study_date", lastStudyDate)
        .order("id")
        .range(from, to)
    ),
  ]);

  const { profiles, preferences } = targetingData;
  const profileIds = new Set(profiles.map((profile) => profile.id));
  const rows: ReturnType<typeof buildReminderRow>[] = [];

  for (const lecture of lectures) {
    const course = lecture.courses?.[0];
    if (lecture.is_cancelled || !course) continue;

    const startAt = lagosLocalTimeToUtc(lecture.lecture_date, lecture.start_time);
    if (startAt <= now) continue;

    for (const profile of profiles) {
      if (
        profile.department !== course.department ||
        profile.level !== course.level
      ) {
        continue;
      }

      const preference = preferences.get(profile.id);
      if (!preference?.lecture_reminders_enabled) continue;

      const reminderAt = new Date(
        startAt.getTime() - preference.lecture_reminder_minutes * 60_000
      );
      if (reminderAt > now) continue;

      rows.push(
        buildReminderRow({
          userId: profile.id,
          notificationType: "lecture_reminder",
          sourceType: "lecture",
          sourceId: lecture.id,
          title: "Lecture reminder",
          message: `An upcoming ${course.course_code} lecture starts soon.`,
          actionUrl: "/timetable",
          dedupeKey: `lecture:${lecture.id}:${profile.id}:${preference.lecture_reminder_minutes}`,
          pushEnabled: preference.push_enabled,
          expiresAt: startAt,
        })
      );
    }
  }

  for (const session of studies) {
    if (session.completed || !profileIds.has(session.user_id)) continue;
    const preference = preferences.get(session.user_id);
    if (!preference?.study_reminders_enabled) continue;

    const reminderMinutes = getReminderMinutes(session.reminder_preference);
    if (reminderMinutes === null) continue;
    const startAt = lagosLocalTimeToUtc(session.study_date, session.start_time);
    if (startAt <= now) continue;

    const reminderAt = new Date(startAt.getTime() - reminderMinutes * 60_000);
    if (reminderAt > now) continue;

    rows.push(
      buildReminderRow({
        userId: session.user_id,
        notificationType: "study_reminder",
        sourceType: "study_session",
        sourceId: session.id,
        title: "Study session reminder",
        message: "A study session you planned starts soon.",
        actionUrl: "/study-planner",
        dedupeKey: `study:${session.id}:${session.user_id}:${reminderMinutes}`,
        pushEnabled: preference.push_enabled,
        expiresAt: startAt,
      })
    );
  }

  const inserted = await insertNotifications(rows);
  return { candidates: rows.length, inserted };
}
