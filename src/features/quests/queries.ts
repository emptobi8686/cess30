import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUserSession } from "@/lib/supabase/auth";
import { getAccessContext } from "@/lib/auth/access-server";
import { requireStaff } from "@/lib/auth/guards";
import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  Quest,
  QuestStatus,
  QuestSubmissionWithQuest,
  XpSummary,
} from "@/types";

/**
 * Fetch all active quests visible to students.
 * Returns quests ordered by creation date (newest first).
 */
export async function getActiveQuests(): Promise<Quest[]> {
  await requireUserSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("quests")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Quest[];
}

/**
 * Fetch a single quest by id. Students can read any active quest;
 * admins can read any quest regardless of active status.
 */
export async function getQuestById(questId: string): Promise<Quest | null> {
  await requireUserSession();
  const access = await getAccessContext();
  const supabase = await createServerSupabaseClient();

  let query = supabase.from("quests").select("*").eq("id", questId);

  if (!access?.isAdmin) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as Quest | null;
}

/**
 * Fetch the current student's quest submissions, optionally filtered by status.
 */
export async function getMyQuestSubmissions(options?: {
  status?: QuestStatus;
}): Promise<QuestSubmissionWithQuest[]> {
  const user = await requireUserSession();
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("quest_submissions")
    .select(`*, quests ( id, title, xp_reward )`)
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as QuestSubmissionWithQuest[];
}

/**
 * Get the total XP and completed quest count for a user.
 */
export async function getUserXpSummary(userId: string): Promise<XpSummary> {
  const supabase = await createServerSupabaseClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  const { data: ledger, error: ledgerError } = await supabase
    .from("xp_ledger")
    .select("xp_amount, quest_id")
    .eq("user_id", userId);

  if (ledgerError) throw new Error(ledgerError.message);

  const totalXp = (ledger ?? []).reduce((sum, entry) => sum + (entry.xp_amount ?? 0), 0);
  const questsCompleted = (ledger ?? []).filter(
    (entry) => entry.quest_id !== null
  ).length;

  return {
    user_id: userId,
    full_name: profile?.full_name ?? "Unknown",
    total_xp: totalXp,
    quests_completed: questsCompleted,
  };
}

/**
 * Fetch the ranked XP leaderboard.
 * Accessible to both students and admins. Only public profile fields
 * (full_name, avatar_url) are exposed — never matric_number, email, or
 * verification status.
 *
 * @param period - 'all-time', 'weekly', or 'monthly'. Ranking boundaries
 *   use the Africa/Lagos timezone.
 */
export async function getLeaderboard(
  period: LeaderboardPeriod = "all-time"
): Promise<LeaderboardEntry[]> {
  await requireUserSession();
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("get_leaderboard", {
    p_period: period,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as LeaderboardEntry[];
}

/**
 * Fetch a single user's leaderboard entry with their rank for a given period.
 */
export async function getLeaderboardEntry(
  userId: string,
  period: LeaderboardPeriod = "all-time"
): Promise<LeaderboardEntry | null> {
  await requireUserSession();
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("get_leaderboard", {
    p_period: period,
  });

  if (error) throw new Error(error.message);
  const entries = (data ?? []) as LeaderboardEntry[];
  return entries.find((e) => e.user_id === userId) ?? null;
}

/**
 * Admin: fetch all quests (active and inactive).
 */
export async function getAllQuestsAdmin(): Promise<Quest[]> {
  const access = await requireStaff();
  const supabase = await createServerSupabaseClient();
  // RLS (quests_select_manage) limits a course representative to quests they manage.
  let query = supabase
    .from("quests")
    .select("*, quest_audiences ( audience_kind, level_code, course_id, offering_id )")
    .order("created_at", { ascending: false });
  if (!access.isAdmin) query = query.in("id", await managedIds(supabase, "managed_quest_ids"));

  const { data, error } = await query;
  if (error) throw new Error("Could not load quests.");
  return (data ?? []) as Quest[];
}

/**
 * Staff: quest submissions with quest info (admins: all; course reps: their levels).
 */
export async function getAllQuestSubmissionsAdmin(options?: {
  status?: QuestStatus;
}): Promise<QuestSubmissionWithQuest[]> {
  const access = await requireStaff();
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("quest_submissions")
    .select(`*, quests ( id, title, xp_reward )`)
    .order("created_at", { ascending: false });

  if (!access.isAdmin) query = query.in("quest_id", await managedIds(supabase, "managed_quest_ids"));
  if (options?.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) throw new Error("Could not load quest submissions.");
  return (data ?? []) as unknown as QuestSubmissionWithQuest[];
}

/**
 * Staff: count pending quest submissions in scope.
 */
export async function getPendingQuestSubmissionsCount(): Promise<number> {
  const access = await requireStaff();
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("quest_submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (!access.isAdmin) query = query.in("quest_id", await managedIds(supabase, "managed_quest_ids"));

  const { count, error } = await query;
  if (error) throw new Error("Could not count quest submissions.");
  return count ?? 0;
}

/**
 * Staff: count active quests in scope.
 */
export async function getActiveQuestsCountAdmin(): Promise<number> {
  const access = await requireStaff();
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("quests").select("id", { count: "exact", head: true }).eq("is_active", true);
  if (!access.isAdmin) query = query.in("id", await managedIds(supabase, "managed_quest_ids"));

  const { count, error } = await query;
  if (error) throw new Error("Could not count quests.");
  return count ?? 0;
}

async function managedIds(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  fn: "managed_quest_ids" | "managed_announcement_ids"
): Promise<string[]> {
  const { data, error } = await supabase.rpc(fn);
  if (error) throw new Error("Could not load your managed items.");
  return ((data ?? []) as unknown as string[]).filter(Boolean);
}
