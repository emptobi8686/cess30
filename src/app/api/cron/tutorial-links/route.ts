import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { FEATURES } from "@/config/features";
import { fetchYouTubeMetadata } from "@/features/tutorials/metadata-core";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Weekly link health (P9): checks up to 50 published YouTube tutorials, oldest check
 * first, through the fixed oEmbed endpoint only, and records link_status/embed_allowed.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!FEATURES.tutorials) return NextResponse.json({ error: "Tutorials are not enabled." }, { status: 404 });
  try {
    const admin = createAdminSupabaseClient();
    const { data: rows, error } = await admin
      .from("tutorials")
      .select("id, provider, provider_video_id")
      .eq("status", "published")
      .eq("provider", "youtube")
      .order("last_link_check_at", { ascending: true, nullsFirst: true })
      .limit(50);
    if (error) throw error;
    let checked = 0;
    let problems = 0;
    for (const row of rows ?? []) {
      if (!row.provider_video_id) continue;
      const meta = await fetchYouTubeMetadata(row.provider_video_id, { apiKey: process.env.YOUTUBE_API_KEY ?? null });
      const status = meta.embeddable === false ? "unavailable_embed" : meta.embeddable === true ? "ok" : "unchecked";
      if (status === "unavailable_embed") problems += 1;
      await admin.from("tutorials").update({
        link_status: status,
        ...(meta.embeddable === null ? {} : { embed_allowed: meta.embeddable }),
        last_link_check_at: new Date().toISOString(),
      }).eq("id", row.id);
      checked += 1;
    }
    return NextResponse.json({ checked, problems });
  } catch (error) {
    console.error("Tutorial link check failed.", { errorName: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "The link check could not complete." }, { status: 500 });
  }
}
