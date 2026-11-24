import "server-only";

import { getNotificationDeliveryStats } from "@/features/notifications/queries";
import { getActiveQuestsCountAdmin, getPendingQuestSubmissionsCount } from "@/features/quests/queries";
import { countOf } from "@/features/admin/overview-core";
import { requireAdmin } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type NotificationDeliveryStats = Awaited<ReturnType<typeof getNotificationDeliveryStats>>;

export type AdminOverviewStats = {
  courses: number;
  sessions: number;
  published: number;
  drafts: number;
  pendingVerifications: number;
  levelRequests: number;
  activeQuests: number | null;
  pendingSubmissions: number | null;
  notifications: NotificationDeliveryStats | null;
  warnings: string[];
};

/** Values that need the service-role key degrade to null with a warning instead of crashing /admin. */
async function optional<T>(load: () => Promise<T>, warnings: string[], warning: string): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    console.error("Admin overview statistic unavailable.", {
      warning,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    if (!warnings.includes(warning)) warnings.push(warning);
    return null;
  }
}

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const warnings: string[] = [];
  const serverStatsWarning = "Server statistics are unavailable (check SUPABASE_SERVICE_ROLE_KEY).";

  const [courses, sessions, published, drafts, pendingVerifications, levelRequests, activeQuests, pendingSubmissions, notifications] =
    await Promise.all([
      supabase.from("courses").select("id", { count: "exact", head: true }),
      supabase.from("lecture_sessions").select("id", { count: "exact", head: true }),
      supabase.from("announcements").select("id", { count: "exact", head: true }).eq("is_published", true),
      supabase.from("announcements").select("id", { count: "exact", head: true }).eq("is_published", false),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
      supabase.from("student_placements").select("id", { count: "exact", head: true }).eq("status", "claimed"),
      optional(getActiveQuestsCountAdmin, warnings, serverStatsWarning),
      optional(getPendingQuestSubmissionsCount, warnings, serverStatsWarning),
      optional(getNotificationDeliveryStats, warnings, serverStatsWarning),
    ]);

  return {
    courses: countOf(courses),
    sessions: countOf(sessions),
    published: countOf(published),
    drafts: countOf(drafts),
    pendingVerifications: countOf(pendingVerifications),
    levelRequests: countOf(levelRequests),
    activeQuests,
    pendingSubmissions,
    notifications,
    warnings,
  };
}
