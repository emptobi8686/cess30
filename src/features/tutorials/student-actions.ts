"use server";

import { revalidatePath } from "next/cache";
import { nextProgress } from "@/features/tutorials/progress";
import { errorState, successState, type ActionState } from "@/lib/action-state";
import { guardStudentAction } from "@/lib/auth/guards";
import { logServerError } from "@/lib/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REASONS = ["broken_link", "not_embeddable", "inaccurate", "inappropriate", "copyright", "other"];

export async function toggleSaveTutorialAction(tutorialId: string): Promise<ActionResult<{ saved: boolean }>> {
  const access = await guardStudentAction("full");
  if (!access.ok) return access;
  if (!UUID.test(tutorialId)) return { ok: false, error: "Tutorial not found." };
  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase.from("tutorial_saves").select("tutorial_id").eq("user_id", access.ctx.userId).eq("tutorial_id", tutorialId).maybeSingle();
  if (existing) await supabase.from("tutorial_saves").delete().eq("user_id", access.ctx.userId).eq("tutorial_id", tutorialId);
  else {
    const { error } = await supabase.from("tutorial_saves").insert({ user_id: access.ctx.userId, tutorial_id: tutorialId });
    if (error) return { ok: false, error: "This tutorial could not be saved." };
  }
  revalidatePath("/tutorials");
  return { ok: true, data: { saved: !existing } };
}

/** Manual completion (works even when YouTube scripts are blocked, e.g. on school networks). */
export async function markTutorialCompletedAction(tutorialId: string, completed: boolean): Promise<ActionResult<{ completed: boolean }>> {
  const access = await guardStudentAction("full");
  if (!access.ok) return access;
  if (!UUID.test(tutorialId)) return { ok: false, error: "Tutorial not found." };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("tutorial_progress").upsert({
    user_id: access.ctx.userId,
    tutorial_id: tutorialId,
    status: completed ? "completed" : "in_progress",
    percent_watched: completed ? 100 : 0,
    completed_at: completed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    logServerError("tutorials.complete", error);
    return { ok: false, error: "Your progress could not be saved." };
  }
  revalidatePath("/tutorials");
  revalidatePath(`/tutorials/${tutorialId}`);
  return { ok: true, data: { completed } };
}

/** Automatic progress (optional player integration): grows only, capped at 100. */
export async function recordTutorialProgressAction(tutorialId: string, positionSeconds: number, durationSeconds: number): Promise<ActionResult> {
  const access = await guardStudentAction("full");
  if (!access.ok) return access;
  if (!UUID.test(tutorialId)) return { ok: false, error: "Tutorial not found." };
  const supabase = await createServerSupabaseClient();
  const { data: prev } = await supabase.from("tutorial_progress").select("percent_watched, status").eq("user_id", access.ctx.userId).eq("tutorial_id", tutorialId).maybeSingle();
  const next = nextProgress(prev ? { percent: Number(prev.percent_watched), status: prev.status } : null, positionSeconds, durationSeconds);
  const { error } = await supabase.from("tutorial_progress").upsert({
    user_id: access.ctx.userId,
    tutorial_id: tutorialId,
    status: next.status,
    percent_watched: next.percent,
    last_position_seconds: next.lastPosition,
    completed_at: next.status === "completed" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  });
  return error ? { ok: false, error: "Your progress could not be saved." } : { ok: true, data: undefined };
}

export async function createPlaylistAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await guardStudentAction("full");
  if (!access.ok) return errorState(access.error);
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2 || title.length > 120) return errorState("Name the playlist (2–120 characters).");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("tutorial_playlists").insert({ owner_id: access.ctx.userId, title, is_official: false });
  if (error) return errorState("The playlist could not be created.");
  revalidatePath("/tutorials");
  return successState(`Playlist "${title}" created.`);
}

export async function addToPlaylistAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await guardStudentAction("full");
  if (!access.ok) return errorState(access.error);
  const playlistId = String(formData.get("playlistId") ?? "");
  const tutorialId = String(formData.get("tutorialId") ?? "");
  if (!UUID.test(playlistId) || !UUID.test(tutorialId)) return errorState("Choose a playlist.");
  const supabase = await createServerSupabaseClient();
  const { data: last } = await supabase.from("tutorial_playlist_items").select("position").eq("playlist_id", playlistId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("tutorial_playlist_items").insert({ playlist_id: playlistId, tutorial_id: tutorialId, position: (last?.position ?? 0) + 1 });
  if (error) return errorState(error.code === "23505" ? "It is already in that playlist." : "It could not be added.");
  revalidatePath(`/tutorials/playlists/${playlistId}`);
  return successState("Added to playlist.");
}

export async function removeFromPlaylistAction(playlistId: string, tutorialId: string): Promise<ActionResult> {
  const access = await guardStudentAction("full");
  if (!access.ok) return access;
  if (!UUID.test(playlistId) || !UUID.test(tutorialId)) return { ok: false, error: "Not found." };
  const supabase = await createServerSupabaseClient();
  await supabase.from("tutorial_playlist_items").delete().eq("playlist_id", playlistId).eq("tutorial_id", tutorialId);
  revalidatePath(`/tutorials/playlists/${playlistId}`);
  return { ok: true, data: undefined };
}

export async function reportTutorialAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await guardStudentAction("full");
  if (!access.ok) return errorState(access.error);
  const tutorialId = String(formData.get("tutorialId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const details = String(formData.get("details") ?? "").trim();
  if (!UUID.test(tutorialId)) return errorState("Tutorial not found.");
  if (!REASONS.includes(reason)) return errorState("Choose a reason.");
  if (details.length > 1000) return errorState("Keep the details under 1000 characters.");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("tutorial_reports").insert({ tutorial_id: tutorialId, reporter_id: access.ctx.userId, reason, details: details || null });
  if (error) {
    if (error.code === "23505") return errorState("You already reported this tutorial.");
    return errorState("The report could not be sent.");
  }
  return successState("Thanks, a reviewer will look at this.");
}
