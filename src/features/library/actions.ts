"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseAudienceField } from "@/features/audiences/schema";
import { libraryDbMessage } from "@/features/library/messages";
import { libraryResourceSchema } from "@/features/library/schema";
import { errorState, successState, type ActionState } from "@/lib/action-state";
import { accessErrorMessage, requireStaff } from "@/lib/auth/guards";
import { logServerError } from "@/lib/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateLibrary(id?: string) {
  revalidatePath("/admin/library");
  revalidatePath("/library");
  if (id) {
    revalidatePath(`/admin/library/${id}`);
    revalidatePath(`/library/${id}`);
  }
}

function fields(formData: FormData) {
  const read = (k: string) => {
    const v = formData.get(k);
    return v === null ? undefined : String(v);
  };
  return {
    title: read("title") ?? "",
    description: read("description"),
    resource_type: read("resource_type") ?? "",
    copyright_basis: read("copyright_basis") ?? "",
    licence_note: read("licence_note"),
    tags: read("tags"),
    course_id: read("course_id"),
    level_code: read("level_code"),
    attestation: read("attestation"),
  };
}

async function saveAudiences(id: string, raw: FormDataEntryValue | null) {
  const parsed = parseAudienceField(String(raw ?? ""));
  if (!parsed.ok) return parsed;
  const { saveAudiences: save } = await import("@/features/audiences/server");
  const saved = await save("library_resource_audiences", id, parsed.audiences);
  return saved.ok ? { ok: true as const } : { ok: false as const, error: saved.error };
}

export async function createLibraryResourceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  try {
    const user = await requireStaff();
    const parsed = libraryResourceSchema.safeParse(fields(formData));
    if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Check the resource details.");
    const { attestation: _attested, ...values } = parsed.data;
    void _attested;
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("library_resources")
      .insert({ ...values, status: "draft", created_by: user.userId })
      .select("id")
      .single();
    if (error) {
      logServerError("library.create", error);
      return errorState(libraryDbMessage(error, "The resource could not be created."));
    }
    const audiences = await saveAudiences(data.id, formData.get("audiences"));
    if (!audiences.ok) {
      await supabase.from("library_resources").delete().eq("id", data.id);
      return errorState(audiences.error);
    }
    createdId = data.id;
    revalidateLibrary(data.id);
  } catch (error) {
    return errorState(accessErrorMessage(error, "The resource could not be created."));
  }
  redirect(`/admin/library/${createdId}?created=1`);
}

export async function updateLibraryResourceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireStaff();
    const id = String(formData.get("resourceId") ?? "");
    if (!UUID.test(id)) return errorState("Resource not found.");
    const parsed = libraryResourceSchema.safeParse(fields(formData));
    if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Check the resource details.");
    const audiences = await saveAudiences(id, formData.get("audiences"));
    if (!audiences.ok) return errorState(audiences.error);
    const { attestation: _attested, ...values } = parsed.data;
    void _attested;
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from("library_resources").update(values).eq("id", id).select("id").maybeSingle();
    if (error || !data) {
      if (error) logServerError("library.update", error);
      return errorState(libraryDbMessage(error, "The resource could not be saved."));
    }
    revalidateLibrary(id);
    return successState("Saved.");
  } catch (error) {
    return errorState(accessErrorMessage(error, "The resource could not be saved."));
  }
}

async function setStatus(formData: FormData, patch: Record<string, unknown>, done: string, fallback: string): Promise<ActionState> {
  try {
    await requireStaff();
    const id = String(formData.get("resourceId") ?? "");
    if (!UUID.test(id)) return errorState("Resource not found.");
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from("library_resources").update(patch).eq("id", id).select("id").maybeSingle();
    if (error || !data) {
      if (error) logServerError("library.status", error);
      return errorState(libraryDbMessage(error, fallback));
    }
    revalidateLibrary(id);
    return successState(done);
  } catch (error) {
    return errorState(accessErrorMessage(error, fallback));
  }
}

export async function publishLibraryResourceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return setStatus(formData, { status: "published" }, "Published. Students in its audience can now find it.", "The resource could not be published.");
}

export async function archiveLibraryResourceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return setStatus(formData, { status: "archived" }, "Archived. It is hidden from students.", "The resource could not be archived.");
}

export async function restoreLibraryResourceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return setStatus(formData, { status: "published" }, "Restored and visible again.", "The resource could not be restored.");
}

/**
 * Takedown: hide immediately (status removed + reason), then delete every stored file
 * object. File rows stay as the audit trail; objects are gone for good.
 */
export async function removeLibraryResourceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 8) return errorState("Give a removal reason of at least 8 characters.");
  const result = await setStatus(formData, { status: "removed", removal_reason: reason }, "Removed. Files deleted from storage.", "The resource could not be removed.");
  if (result.status !== "success") return result;
  try {
    const id = String(formData.get("resourceId"));
    const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");
    const service = createAdminSupabaseClient();
    const { data: files } = await service.from("library_files").select("storage_path").eq("resource_id", id);
    const paths = (files ?? []).map((f) => f.storage_path);
    if (paths.length) {
      const { error } = await service.storage.from("library").remove(paths);
      if (error) {
        logServerError("library.removeObjects", error);
        return errorState("Hidden from students, but the stored files could not be deleted. Try again.");
      }
    }
  } catch (error) {
    logServerError("library.removeObjects", error);
    return errorState("Hidden from students, but the stored files could not be deleted. Try again.");
  }
  return result;
}

/**
 * Resolves a student report. "takedown" removes the resource (and its files) using the
 * note as the removal reason; "dismissed" needs a note of at least 8 characters.
 */
export async function resolveLibraryReportAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requireStaff();
    const reportId = String(formData.get("reportId") ?? "");
    const decision = String(formData.get("decision") ?? "");
    const note = String(formData.get("note") ?? "").trim();
    if (!UUID.test(reportId)) return errorState("Report not found.");
    if (!["actioned", "dismissed", "takedown"].includes(decision)) return errorState("Choose how to resolve the report.");
    if ((decision === "dismissed" || decision === "takedown") && note.length < 8) {
      return errorState("Add a note of at least 8 characters.");
    }
    if (decision === "takedown") {
      const removal = new FormData();
      removal.set("resourceId", String(formData.get("resourceId") ?? ""));
      removal.set("reason", note);
      const removed = await removeLibraryResourceAction(_previous, removal);
      if (removed.status !== "success") return removed;
    }
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("library_reports")
      .update({
        status: decision === "dismissed" ? "dismissed" : "actioned",
        resolved_by: user.userId,
        resolved_at: new Date().toISOString(),
        resolution_note: note.length >= 8 ? note : null,
      })
      .eq("id", reportId)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      if (error) logServerError("library.resolveReport", error);
      return errorState("The report could not be updated.");
    }
    revalidateLibrary();
    return successState(decision === "takedown" ? "Taken down and resolved." : "Report resolved.");
  } catch (error) {
    return errorState(accessErrorMessage(error, "The report could not be updated."));
  }
}
