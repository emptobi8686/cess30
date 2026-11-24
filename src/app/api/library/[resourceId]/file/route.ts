import { NextResponse, type NextRequest } from "next/server";
import { buildContentDisposition, parseFileMode, SIGNED_URL_TTL } from "@/features/library/disposition";
import { logServerError } from "@/lib/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound() {
  // 404 for anything the caller may not see, so existence is never leaked.
  return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

/**
 * GET /api/library/{id}/file?mode=download|preview
 * Authorises with the caller's own RLS view of the resource, then redirects to a
 * short-lived signed URL for the current file in the private bucket.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/library/[resourceId]/file">) {
  const { resourceId } = await ctx.params;
  if (!UUID.test(resourceId)) return notFound();
  const mode = parseFileMode(request.nextUrl.searchParams.get("mode"));

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const { data: resource } = await supabase
    .from("library_resources")
    .select("id, title, current_file_id")
    .eq("id", resourceId)
    .maybeSingle();
  if (!resource?.current_file_id) return notFound();

  const service = createAdminSupabaseClient();
  const { data: file } = await service
    .from("library_files")
    .select("id, storage_path, mime_type, original_filename")
    .eq("id", resource.current_file_id)
    .eq("resource_id", resourceId)
    .maybeSingle();
  if (!file) return notFound();
  if (mode === "preview" && file.mime_type !== "application/pdf") {
    return new NextResponse("Preview is only available for PDF files.", { status: 415, headers: { "Cache-Control": "no-store" } });
  }

  const { data: signed, error } = await service.storage
    .from("library")
    .createSignedUrl(file.storage_path, SIGNED_URL_TTL[mode], buildContentDisposition(file.original_filename, mode));
  if (error || !signed) {
    logServerError("library.signDownload", error ?? new Error("no signed url"));
    return new NextResponse("The file is unavailable right now.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  await service.from("library_access_log").insert({ user_id: user.id, resource_id: resourceId, file_id: file.id, mode });

  const response = NextResponse.redirect(signed.signedUrl, 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
