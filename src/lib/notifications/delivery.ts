import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  addCalendarDays,
  getLagosDateAndTime,
  getReminderMinutes,
  lagosLocalTimeToUtc,
} from "@/lib/notifications/time";
import { eligibleNotificationProfiles, type TargetingProfile } from "@/lib/notifications/rows";
import type {
  NotificationPreferences,
  NotificationSourceType,
  NotificationType,
} from "@/types";

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
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

type LectureCandidate = {
  user_id: string;
  lecture_id: string;
  course_code: string;
  starts_at: string;
  reminder_minutes: number;
  push_enabled: boolean;
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
  const [profiles, preferences, roleRows] = await Promise.all([
    fetchAll<TargetingProfile>((from, to) =>
      admin
        .from("profiles")
        .select("id, department, level, verification_status")
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
    fetchAll<{ user_id: string; role: string }>((from, to) =>
      admin
        .from("user_roles")
        .select("user_id, role")
        .order("user_id")
        .order("role")
        .range(from, to)
    ),
  ]);

  return {
    admin,
    profiles: eligibleNotificationProfiles(profiles, roleRows),
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

/**
 * Queues announcement notifications for the announcement's audiences (E4/E5). Recipients
 * are computed in SQL (announcement_recipients): verified students matching any audience
 * with announcement notifications on.
 */
export async function enqueueAnnouncementNotifications(
  announcement: { id: string; title: string },
  sendPush: boolean
) {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("announcement_recipients", { p_announcement_id: announcement.id });
  if (error) throw new Error(error.message);
  const recipients = (data ?? []) as Array<{ user_id: string; push_enabled: boolean }>;

  const rows = recipients.map((recipient) =>
    buildReminderRow({
      userId: recipient.user_id,
      notificationType: "announcement",
      sourceType: "announcement",
      sourceId: announcement.id,
      title: announcement.title.slice(0, 160),
      message: "A new academic announcement is available.",
      actionUrl: "/announcements",
      dedupeKey: `announcement:${announcement.id}:${recipient.user_id}`,
      pushEnabled: sendPush && recipient.push_enabled,
      expiresAt: null,
    })
  );

  return insertNotifications(rows);
}

export async function createDueReminderNotifications() {
  const admin = createAdminSupabaseClient();
  const { date: today } = getLagosDateAndTime(new Date());
  const now = new Date();
  const lastStudyDate = addCalendarDays(today, 2);
  const [targetingData, lectureCandidates, studies] = await Promise.all([
    loadTargetingData(),
    // Enrolment-based recipients (carry-over included, dropped excluded), computed in SQL.
    admin
      .rpc("lecture_reminder_candidates", {
        p_from: now.toISOString(),
        p_to: new Date(now.getTime() + 2 * 24 * 60 * 60_000).toISOString(),
      })
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data ?? []) as LectureCandidate[];
      }),
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

  for (const candidate of lectureCandidates) {
    const startAt = new Date(candidate.starts_at);
    if (startAt <= now) continue;
    const reminderAt = new Date(startAt.getTime() - candidate.reminder_minutes * 60_000);
    if (reminderAt > now) continue;

    rows.push(
      buildReminderRow({
        userId: candidate.user_id,
        notificationType: "lecture_reminder",
        sourceType: "lecture",
        sourceId: candidate.lecture_id,
        title: "Lecture reminder",
        message: `An upcoming ${candidate.course_code} lecture starts soon.`,
        actionUrl: "/timetable",
        dedupeKey: `lecture:${candidate.lecture_id}:${candidate.user_id}:${candidate.reminder_minutes}`,
        pushEnabled: candidate.push_enabled,
        expiresAt: startAt,
      })
    );
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
