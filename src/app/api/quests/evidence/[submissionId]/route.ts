import { NextResponse } from "next/server";
import { EVIDENCE_BUCKET } from "@/features/quests/evidence-file";
import { logServerError } from "@/lib/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound() {
  return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

/**
 * GET /api/quests/evidence/{submissionId}
 * Opens an uploaded evidence file. The caller's own RLS view decides access (the student
 * who submitted it, or staff who manage the quest); the file is then served through a
 * one-minute signed link to the private bucket.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/quests/evidence/[submissionId]">) {
  const { submissionId } = await ctx.params;
  if (!UUID.test(submissionId)) return notFound();

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const { data: submission } = await supabase
    .from("quest_submissions")
    .select("evidence_path")
    .eq("id", submissionId)
    .maybeSingle();
  if (!submission?.evidence_path) return notFound();

  const { data: signed, error } = await createAdminSupabaseClient()
    .storage.from(EVIDENCE_BUCKET)
    .createSignedUrl(submission.evidence_path, 60);
  if (error || !signed) {
    logServerError("quests.signEvidence", error ?? new Error("no signed url"));
    return new NextResponse("The file is unavailable right now.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const response = NextResponse.redirect(signed.signedUrl, 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
