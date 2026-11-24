import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AUDIENCE_SELECT } from "@/features/audiences/schema";
import type { Announcement } from "@/types";

/**
 * Fetch announcements visible to students.
 *
 * RLS is the authoritative gate (is_published = true AND published_at <= now()
 * in the database). The explicit filters here are defence in depth: they also
 * prevent an administrator browsing the student page from seeing drafts.
 *
 * `published_at` is a timestamptz, so comparing it to an ISO instant is
 * timezone-safe. No calendar-date conversion is involved.
 */
export async function getPublishedAnnouncements(limit = 20): Promise<Announcement[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(`*, announcement_audiences ( ${AUDIENCE_SELECT} )`)
    .eq("is_published", true)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as Announcement[];
}

/**
 * Fetch the N most recent published announcements for the dashboard widget.
 */
export async function getRecentAnnouncements(limit = 3): Promise<Announcement[]> {
  return getPublishedAnnouncements(limit);
}

/**
 * Fetch ALL announcements (including drafts) for the admin management view.
 * The RLS policy allows admins to see all rows.
 */
export async function getAllAnnouncementsAdmin(): Promise<Announcement[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Announcement[];
}

/**
 * Fetch a single announcement by ID. Used for detail and edit views.
 */
export async function getAnnouncementById(id: string): Promise<Announcement | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Announcement | null;
}
