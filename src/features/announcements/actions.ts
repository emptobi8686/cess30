"use server";

import { actionError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/guards";
import { enqueueAnnouncementNotifications } from "@/lib/notifications/delivery";
import { announcementSchema } from "@/features/announcements/validation";
import { parseAudienceField, scopeForAudiences } from "@/features/audiences/schema";
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
    const user = await requireStaff();
    const supabase = await createServerSupabaseClient();

    const audienceField = parseAudienceField(String(formData.get("audiences") ?? ""));
    if (!audienceField.ok) return { ok: false, error: audienceField.error };
    const audiences = audienceField.audiences;
    const derived = scopeForAudiences(audiences);

    const parsed = announcementSchema.safeParse({
      title: String(formData.get("title") ?? ""),
      content: String(formData.get("content") ?? ""),
      scope: derived.scope,
      course_id: derived.course_id ?? "",
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the announcement details." };
    }
    const { title, content, scope, course_id } = parsed.data;
    const publish = formData.get("publish") === "true";
    const notifyStudents = formData.get("notify_students") === "true";
    const sendPush = formData.get("send_push") === "true";
    if (publish && audiences.length === 0) {
      return { ok: false, error: "Choose who should see this announcement before publishing it." };
    }

    // Saved as a draft first; it is published only once its audiences are stored, so
    // nobody outside the audience can ever read it (E5 deny-by-default).
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
        is_published: false,
        published_at: now,
      })
      .select("id")
      .single();

    if (error) return actionError("announcements", error, "announcement");

    const saved = await (await import("@/features/audiences/server")).saveAudiences("announcement_audiences", data.id, audiences);
    if (!saved.ok) {
      await supabase.from("announcements").delete().eq("id", data.id);
      return { ok: false, error: saved.error };
    }

    if (publish) {
      const { error: publishError } = await supabase
        .from("announcements")
        .update({ is_published: true, published_at: new Date().toISOString() })
        .eq("id", data.id);
      if (publishError) return actionError("announcements", publishError, "announcement");
    }

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
    const user = await requireStaff();
    const supabase = await createServerSupabaseClient();

    const audienceField = parseAudienceField(String(formData.get("audiences") ?? ""));
    if (!audienceField.ok) return { ok: false, error: audienceField.error };
    const derived = scopeForAudiences(audienceField.audiences);

    const parsed = announcementSchema.safeParse({
      title: String(formData.get("title") ?? ""),
      content: String(formData.get("content") ?? ""),
      scope: derived.scope,
      course_id: derived.course_id ?? "",
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the announcement details." };
    }
    const { title, content, scope, course_id } = parsed.data;

    // Audiences first: the database refuses targets outside the editor's scope.
    const saved = await (await import("@/features/audiences/server")).saveAudiences("announcement_audiences", id, audienceField.audiences);
    if (!saved.ok) return { ok: false, error: saved.error };

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
    const user = await requireStaff();
    const supabase = await createServerSupabaseClient();
    const { count: audienceCount } = await supabase
      .from("announcement_audiences")
      .select("id", { count: "exact", head: true })
      .eq("announcement_id", id);
    if (!audienceCount) {
      return { ok: false, error: "Choose who should see this announcement before publishing it." };
    }
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
    const user = await requireStaff();
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
    await requireStaff();
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
