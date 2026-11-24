"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseAudienceField } from "@/features/audiences/schema";
import { tutorialSchema } from "@/features/tutorials/schema";
import { parseVideoUrl, watchUrlFor } from "@/features/tutorials/video-url";
import { errorState, successState, type ActionState } from "@/lib/action-state";
import { accessErrorMessage, requireStaff } from "@/lib/auth/guards";
import { logServerError } from "@/lib/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SAFE = [
  "This tutorial must be reviewed and approved before publishing.",
  "Choose who should see this tutorial before publishing it.",
  "You cannot review your own content.",
  "You cannot review this tutorial.",
  "Add review notes of at least 8 characters.",
  "You cannot target that audience.",
  "You cannot change who sees this.",
];
const message = (error: { message?: string } | null, fallback: string) =>
  error?.message && SAFE.includes(error.message) ? error.message : fallback;

function revalidateTutorials(id?: string) {
  revalidatePath("/admin/tutorials");
  revalidatePath("/tutorials");
  if (id) {
    revalidatePath(`/admin/tutorials/${id}`);
    revalidatePath(`/tutorials/${id}`);
  }
}

function read(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return v === null ? undefined : String(v);
  };
  return {
    title: get("title") ?? "",
    description: get("description"),
    topic: get("topic") ?? "",
    learning_objectives: get("learning_objectives") ?? "",
    video_url: get("video_url") ?? "",
    duration_minutes: get("duration_minutes"),
    course_id: get("course_id"),
    level_code: get("level_code"),
  };
}

/** Parses the form, re-checks the link against the database allow-list, and looks up YouTube details. */
async function buildRow(formData: FormData) {
  const parsed = tutorialSchema.safeParse(read(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Check the tutorial details." };
  const supabase = await createServerSupabaseClient();
  const { data: domains } = await supabase.from("tutorial_provider_domains").select("domain, embed_allowed");
  const video = parseVideoUrl(parsed.data.video_url, (domains ?? []).map((d) => d.domain));
  if (!video) return { ok: false as const, error: "That site is not on the approved list." };

  let embedAllowed = video.provider !== "other_allowlisted";
  let creatorName: string | null = null;
  let duration = parsed.data.duration_seconds;
  if (video.provider === "youtube") {
    const { fetchYouTubeMetadata } = await import("@/features/tutorials/metadata-core");
    const meta = await fetchYouTubeMetadata(video.id, { apiKey: process.env.YOUTUBE_API_KEY ?? null });
    if (meta.embeddable === false) embedAllowed = false;
    creatorName = meta.author;
    duration = duration ?? meta.durationSeconds;
  }
  const d = parsed.data;
  return {
    ok: true as const,
    row: {
      title: d.title,
      description: d.description,
      topic: d.topic,
      learning_objectives: d.learning_objectives,
      course_id: d.course_id,
      level_code: d.level_code,
      // AI-generated videos are disabled for now (the database refuses them too).
      is_ai_generated: false,
      ai_tool: null,
      ai_disclosure: null,
      source_type: video.provider === "youtube" ? "youtube" : "external_platform",
      provider: video.provider,
      provider_video_id: video.provider === "other_allowlisted" ? null : video.id,
      external_url: watchUrlFor(video),
      embed_allowed: embedAllowed,
      creator_name: creatorName,
      provider_name: video.provider === "other_allowlisted" ? video.host : video.provider === "youtube" ? "YouTube" : "Vimeo",
      duration_seconds: duration,
    },
  };
}

async function saveAudiences(id: string, raw: FormDataEntryValue | null) {
  const parsed = parseAudienceField(String(raw ?? ""));
  if (!parsed.ok) return parsed;
  const { saveAudiences: save } = await import("@/features/audiences/server");
  const saved = await save("tutorial_audiences", id, parsed.audiences);
  return saved.ok ? { ok: true as const } : { ok: false as const, error: saved.error };
}

export async function createTutorialAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  let id: string | null = null;
  try {
    const user = await requireStaff();
    const built = await buildRow(formData);
    if (!built.ok) return errorState(built.error);
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from("tutorials").insert({ ...built.row, status: "draft", created_by: user.userId }).select("id").single();
    if (error) {
      logServerError("tutorials.create", error);
      return errorState(message(error, "The tutorial could not be created."));
    }
    const audiences = await saveAudiences(data.id, formData.get("audiences"));
    if (!audiences.ok) {
      await supabase.from("tutorials").delete().eq("id", data.id);
      return errorState(audiences.error);
    }
    id = data.id;
    revalidateTutorials(data.id);
  } catch (error) {
    return errorState(accessErrorMessage(error, "The tutorial could not be created."));
  }
  redirect(`/admin/tutorials/${id}?created=1`);
}

export async function updateTutorialAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireStaff();
    const id = String(formData.get("tutorialId") ?? "");
    if (!UUID.test(id)) return errorState("Tutorial not found.");
    const built = await buildRow(formData);
    if (!built.ok) return errorState(built.error);
    const audiences = await saveAudiences(id, formData.get("audiences"));
    if (!audiences.ok) return errorState(audiences.error);
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from("tutorials").update(built.row).eq("id", id).select("id, status").maybeSingle();
    if (error || !data) {
      if (error) logServerError("tutorials.update", error);
      return errorState(message(error, "The tutorial could not be saved."));
    }
    revalidateTutorials(id);
    return successState("Saved.");
  } catch (error) {
    return errorState(accessErrorMessage(error, "The tutorial could not be saved."));
  }
}

async function setStatus(formData: FormData, patch: Record<string, unknown>, done: string, fallback: string): Promise<ActionState> {
  try {
    await requireStaff();
    const id = String(formData.get("tutorialId") ?? "");
    if (!UUID.test(id)) return errorState("Tutorial not found.");
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from("tutorials").update(patch).eq("id", id).select("id").maybeSingle();
    if (error || !data) {
      if (error) logServerError("tutorials.status", error);
      return errorState(message(error, fallback));
    }
    revalidateTutorials(id);
    return successState(done);
  } catch (error) {
    return errorState(accessErrorMessage(error, fallback));
  }
}

export async function submitForReviewAction(_p: ActionState, fd: FormData) {
  return setStatus(fd, { status: "in_review" }, "Sent for review. Another reviewer must approve it.", "The tutorial could not be submitted.");
}
export async function publishTutorialAction(_p: ActionState, fd: FormData) {
  return setStatus(fd, { status: "published" }, "Published.", "The tutorial could not be published.");
}
export async function archiveTutorialAction(_p: ActionState, fd: FormData) {
  return setStatus(fd, { status: "archived" }, "Archived. Hidden from students.", "The tutorial could not be archived.");
}
export async function removeTutorialAction(_p: ActionState, fd: FormData) {
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 8) return errorState("Give a removal reason of at least 8 characters.");
  return setStatus(fd, { status: "removed", removal_reason: reason }, "Removed.", "The tutorial could not be removed.");
}

export async function reviewTutorialAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireStaff();
    const id = String(formData.get("tutorialId") ?? "");
    const decision = String(formData.get("decision") ?? "");
    const notes = String(formData.get("notes") ?? "");
    if (!UUID.test(id)) return errorState("Tutorial not found.");
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("review_tutorial", { p_id: id, p_decision: decision, p_notes: notes });
    if (error) {
      logServerError("tutorials.review", error);
      return errorState(message(error, "The review could not be saved."));
    }
    revalidateTutorials(id);
    return successState(decision === "approved" ? "Approved. It can now be published." : "Review saved.");
  } catch (error) {
    return errorState(accessErrorMessage(error, "The review could not be saved."));
  }
}

export async function resolveTutorialReportAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requireStaff();
    const reportId = String(formData.get("reportId") ?? "");
    const decision = String(formData.get("decision") ?? "");
    const note = String(formData.get("note") ?? "").trim();
    if (!UUID.test(reportId)) return errorState("Report not found.");
    if (!["actioned", "dismissed"].includes(decision)) return errorState("Choose how to resolve the report.");
    if (decision === "dismissed" && note.length < 8) return errorState("Add a note of at least 8 characters.");
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from("tutorial_reports")
      .update({ status: decision, resolved_by: user.userId, resolved_at: new Date().toISOString(), resolution_note: note.length >= 8 ? note : null })
      .eq("id", reportId).select("id").maybeSingle();
    if (error || !data) {
      if (error) logServerError("tutorials.resolveReport", error);
      return errorState("The report could not be updated.");
    }
    revalidateTutorials();
    return successState("Report resolved.");
  } catch (error) {
    return errorState(accessErrorMessage(error, "The report could not be updated."));
  }
}
