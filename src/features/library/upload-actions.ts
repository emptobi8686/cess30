"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { LIBRARY_EXT, LIBRARY_MAX_BYTES, normaliseDeclaredMime, readZipEntryNames, safeDisplayFilename, validateLibraryUpload } from "@/features/library/file-validation";
import { finalizeDecision, planObjectPath } from "@/features/library/upload-plan";
import { accessErrorMessage, requireStaff } from "@/lib/auth/guards";
import { logServerError } from "@/lib/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function canManage(resourceId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("can_manage_library_resource", { p_id: resourceId });
  return data === true;
}

async function admin() {
  const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");
  return createAdminSupabaseClient();
}

/**
 * Step 1: reserve a new file version and hand the browser a one-time signed upload URL
 * for a server-chosen path in the private bucket.
 */
export async function startLibraryUploadAction(input: {
  resourceId: string;
  declaredMime: string;
  sizeBytes: number;
  originalFilename: string;
}): Promise<ActionResult<{ fileId: string; path: string; token: string }>> {
  try {
    const user = await requireStaff();
    if (!UUID.test(input.resourceId)) return { ok: false, error: "Resource not found." };
    if (!(await canManage(input.resourceId))) return { ok: false, error: "You cannot upload files to this resource." };
    if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > LIBRARY_MAX_BYTES) {
      return { ok: false, error: "The file is larger than 25 MB." };
    }
    const mime = normaliseDeclaredMime(input.declaredMime);
    if (!mime) return { ok: false, error: "That file type is not allowed. Use PDF, PowerPoint, Word, PNG, JPEG or plain text." };

    const service = await admin();
    const { data: last } = await service
      .from("library_files")
      .select("version")
      .eq("resource_id", input.resourceId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const fileId = randomUUID();
    const path = planObjectPath(input.resourceId, fileId, LIBRARY_EXT[mime]);
    const { error: insertError } = await service.from("library_files").insert({
      id: fileId,
      resource_id: input.resourceId,
      version: (last?.version ?? 0) + 1,
      storage_path: path,
      mime_type: mime,
      original_filename: safeDisplayFilename(input.originalFilename),
      uploaded_by: user.userId,
      scan_status: "pending",
    });
    if (insertError) {
      logServerError("library.startUpload", insertError);
      return { ok: false, error: "The upload could not be started." };
    }
    const { data: signed, error: signError } = await service.storage.from("library").createSignedUploadUrl(path);
    if (signError || !signed) {
      logServerError("library.signUpload", signError ?? new Error("no signed url"));
      await service.from("library_files").delete().eq("id", fileId);
      return { ok: false, error: "The upload could not be started." };
    }
    return { ok: true, data: { fileId, path, token: signed.token } };
  } catch (error) {
    return { ok: false, error: accessErrorMessage(error, "The upload could not be started.") };
  }
}

/**
 * Step 2: after the browser uploaded, read the stored bytes, validate the real content,
 * record size and SHA-256, and make it the resource's current file. Anything that fails
 * validation is deleted (object and row).
 */
export async function finalizeLibraryUploadAction(fileId: string): Promise<ActionResult<{ version: number }>> {
  try {
    await requireStaff();
    if (!UUID.test(fileId)) return { ok: false, error: "Upload not found." };
    const service = await admin();
    const { data: file } = await service
      .from("library_files")
      .select("id, resource_id, version, storage_path, mime_type, scan_status")
      .eq("id", fileId)
      .maybeSingle();
    if (!file || file.scan_status !== "pending") return { ok: false, error: "Upload not found." };
    if (!(await canManage(file.resource_id))) return { ok: false, error: "You cannot upload files to this resource." };

    const { data: blob, error: downloadError } = await service.storage.from("library").download(file.storage_path);
    if (downloadError || !blob) {
      await service.from("library_files").delete().eq("id", fileId);
      return { ok: false, error: "The upload did not arrive. Please try again." };
    }
    const buffer = new Uint8Array(await blob.arrayBuffer());
    const result = validateLibraryUpload({
      declaredMime: file.mime_type ?? "",
      sizeBytes: buffer.length,
      head: buffer,
      zipEntryNames: readZipEntryNames(buffer) ?? undefined,
    });
    const decision = finalizeDecision(result);
    if (decision.action === "reject") {
      await service.storage.from("library").remove([file.storage_path]);
      await service.from("library_files").delete().eq("id", fileId);
      return { ok: false, error: decision.message };
    }

    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const { error: updateError } = await service
      .from("library_files")
      .update({ size_bytes: buffer.length, sha256, scan_status: "not_scanned" })
      .eq("id", fileId);
    const { error: currentError } = await service
      .from("library_resources")
      .update({ current_file_id: fileId })
      .eq("id", file.resource_id);
    if (updateError || currentError) {
      logServerError("library.finalize", updateError ?? currentError);
      return { ok: false, error: "The file was uploaded but could not be saved." };
    }
    revalidatePath(`/admin/library/${file.resource_id}`);
    return { ok: true, data: { version: file.version } };
  } catch (error) {
    return { ok: false, error: accessErrorMessage(error, "The upload could not be finished.") };
  }
}
