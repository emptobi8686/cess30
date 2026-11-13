// ---------------------------------------------------------------------------
// Shared feature types
// ---------------------------------------------------------------------------

export type FeaturePillar = {
  title: string;
  description: string;
};

// ---------------------------------------------------------------------------
// Database row types (mirror the schema in supabase/migrations/)
// ---------------------------------------------------------------------------

export type UserRole = "student" | "admin";

export type VerificationStatus = "pending" | "verified" | "rejected" | "suspended";

export type Profile = {
  id: string;
  full_name: string;
  matric_number: string | null;
  department: string;
  level: string;
  avatar_url: string | null;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
};

export type Course = {
  id: string;
  course_code: string;
  course_title: string;
  credit_units: number;
  level: string;
  department: string;
  created_at: string;
};

export type UserRoleRow = {
  id: string;
  user_id: string;
  role: UserRole;
  assigned_by: string | null;
  created_at: string;
};

export type LectureSession = {
  id: string;
  course_id: string;
  lecture_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  lecturer_name: string | null;
  is_cancelled: boolean;
  cancelled_at: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

/** LectureSession joined with its course details */
export type LectureSessionWithCourse = LectureSession & {
  courses: Pick<Course, "course_code" | "course_title">;
};

export type ReminderPreference = "none" | "15_min" | "30_min" | "1_hour" | "1_day";

export type RecurrencePattern = "daily" | "weekly" | "selected_weekdays";

export type StudySession = {
  id: string;
  user_id: string;
  course_id: string | null;
  title: string;
  study_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  location: string | null;
  reminder_preference: ReminderPreference;
  completed: boolean;
  completed_at: string | null;
  recurrence_id: string | null;
  recurrence_pattern: RecurrencePattern | null;
  recurrence_end_date: string | null;
  created_at: string;
  updated_at: string;
};

/** StudySession joined with its optional course details */
export type StudySessionWithCourse = StudySession & {
  courses: Pick<Course, "course_code" | "course_title"> | null;
};

export type Announcement = {
  id: string;
  title: string;
  content: string;
  scope: "all" | "department" | "level" | "course";
  course_id: string | null;
  created_by: string;
  updated_by: string | null;
  is_published: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
};

export type NotificationType =
  | "lecture_reminder"
  | "study_reminder"
  | "announcement"
  | "system";

export type NotificationSourceType =
  | "lecture"
  | "study_session"
  | "announcement"
  | "system";

export type AppNotification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: NotificationType;
  source_type: NotificationSourceType;
  source_id: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  push_requested: boolean;
  push_status: "not_requested" | "pending" | "sending" | "sent" | "failed" | "disabled";
  created_at: string;
};

export type NotificationPreferences = {
  user_id: string;
  push_enabled: boolean;
  lecture_reminders_enabled: boolean;
  study_reminders_enabled: boolean;
  announcement_notifications_enabled: boolean;
  lecture_reminder_minutes: 15 | 30 | 60;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  created_at: string;
  updated_at: string;
};

export type PushDevice = {
  id: string;
  device_label: string;
  created_at: string;
  last_used_at: string;
};

// ---------------------------------------------------------------------------
// Auth & Action helpers
// ---------------------------------------------------------------------------

/** Result shape returned by server actions */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
