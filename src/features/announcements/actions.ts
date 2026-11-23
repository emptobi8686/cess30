"use server";

import { actionError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { enqueueAnnouncementNotifications } from "@/lib/notifications/delivery";
import { announcementSchema } from "@/features/announcements/validation";
import type { ActionResult } from "@/types";

function revalidateAnnouncements() {
  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

// ─────────────────────────────────────────────────────────────────────────────
// Create announcement (draft or published)
// ─────────────────────────────────────────────────────────────────────────────

export async function createAnnouncement(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAdmin();
    const supabase = await createServerSupabaseClient();

    const parsed = announcementSchema.safeParse({
      title: String(formData.get("title") ?? ""),
      content: String(formData.get("content") ?? ""),
      scope: String(formData.get("scope") ?? "").trim(),
      course_id: String(formData.get("course_id") ?? ""),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the announcement details." };
    }
    const { title, content, scope, course_id } = parsed.data;
    const publish = formData.get("publish") === "true";
    const notifyStudents = formData.get("notify_students") === "true";
    const sendPush = formData.get("send_push") === "true";


    // published_at is an instant (timestamptz). It records when the row was
    // created; the student-facing RLS gate additionally requires
    // is_published = true and published_at <= now().
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title,
        content,
        scope,
        course_id,
        created_by: user.userId,
        updated_by: user.userId,
        is_published: publish,
        published_at: now,
      })
      .select("id")
      .single();

    if (error) return actionError("announcements", error, "announcement");

    if (publish && notifyStudents) {
      try {
        await enqueueAnnouncementNotifications(
          { id: data.id, title, scope: scope as "all" | "department" | "level" | "course", course_id },
          sendPush
        );
      } catch (notificationError) {
        console.error("Announcement was published but notifications were not queued.", {
          errorName:
            notificationError instanceof Error ? notificationError.name : "unknown",
        });
        return {
          ok: false,
          error: "The announcement was published, but its notifications could not be queued.",
        };
      }
    }

    revalidateAnnouncements();
    return { ok: true, data: { id: data.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update announcement
// ─────────────────────────────────────────────────────────────────────────────

export async function updateAnnouncement(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const supabase = await createServerSupabaseClient();

    const parsed = announcementSchema.safeParse({
      title: String(formData.get("title") ?? ""),
      content: String(formData.get("content") ?? ""),
      scope: String(formData.get("scope") ?? "").trim(),
      course_id: String(formData.get("course_id") ?? ""),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the announcement details." };
    }
    const { title, content, scope, course_id } = parsed.data;

    const { data, error } = await supabase
      .from("announcements")
      .update({ title, content, scope, course_id, updated_by: user.userId })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return actionError("announcements", error, "announcement");
    if (!data) {
      return { ok: false, error: "Announcement not found or you do not have permission to edit it." };
    }

    revalidateAnnouncements();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Publish / unpublish
// ─────────────────────────────────────────────────────────────────────────────

export async function publishAnnouncement(
  id: string,
  notifyStudents = false,
  sendPush = false
): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("announcements")
      .update({
        is_published: true,
        published_at: new Date().toISOString(),
        updated_by: user.userId,
      })
      .eq("id", id)
      .select("id, title, scope, course_id")
      .maybeSingle();

    if (error) return actionError("announcements", error, "announcement");
    if (!data) return { ok: false, error: "Announcement not found or you do not have permission to publish it." };

    if (notifyStudents) {
      try {
        await enqueueAnnouncementNotifications(
          {
            id: data.id,
            title: data.title,
            scope: data.scope,
            course_id: data.course_id,
          },
          sendPush
        );
      } catch (notificationError) {
        console.error("Announcement was published but notifications were not queued.", {
          errorName:
            notificationError instanceof Error ? notificationError.name : "unknown",
        });
        return {
          ok: false,
          error: "The announcement was published, but its notifications could not be queued.",
        };
      }
    }

    revalidateAnnouncements();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

export async function unpublishAnnouncement(id: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("announcements")
      .update({ is_published: false, updated_by: user.userId })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return actionError("announcements", error, "announcement");
    if (!data) return { ok: false, error: "Announcement not found or you do not have permission to unpublish it." };

    revalidateAnnouncements();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete announcement
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return actionError("announcements", error, "announcement");
    if (!data) {
      return { ok: false, error: "Announcement not found or you do not have permission to delete it." };
    }

    revalidateAnnouncements();
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error." };
  }
}
