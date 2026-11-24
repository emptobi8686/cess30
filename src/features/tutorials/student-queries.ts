import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TUTORIAL_SELECT, type TutorialRow } from "./queries";

export async function searchTutorials(f: { q: string; level: string | null; source: string | null }): Promise<TutorialRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("search_tutorials", { p_query: f.q, p_level_code: f.level, p_source_type: f.source, p_limit: 50 });
  if (error) throw new Error("Could not search tutorials.");
  return (data ?? []) as TutorialRow[];
}

export async function getMyTutorialState(userId: string) {
  const supabase = await createServerSupabaseClient();
  const [{ data: saves }, { data: progress }, { data: playlists }] = await Promise.all([
    supabase.from("tutorial_saves").select("tutorial_id").eq("user_id", userId),
    supabase.from("tutorial_progress").select("tutorial_id, status, percent_watched").eq("user_id", userId),
    supabase.from("tutorial_playlists").select("id, title, is_official, owner_id").eq("status", "active").order("is_official", { ascending: false }).order("title"),
  ]);
  return {
    saved: new Set((saves ?? []).map((s) => s.tutorial_id)),
    progress: new Map((progress ?? []).map((p) => [p.tutorial_id, p])),
    playlists: (playlists ?? []) as Array<{ id: string; title: string; is_official: boolean; owner_id: string | null }>,
  };
}

export async function getTutorialForStudent(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("tutorials").select(TUTORIAL_SELECT).eq("id", id).eq("status", "published").maybeSingle();
  if (!data) return null;
  const tutorial = data as unknown as TutorialRow;
  return { tutorial };
}

export async function getPlaylist(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: playlist } = await supabase.from("tutorial_playlists").select("id, title, description, is_official, owner_id").eq("id", id).maybeSingle();
  if (!playlist) return null;
  const { data: items } = await supabase.from("tutorial_playlist_items")
    .select("position, tutorials ( id, title, topic, duration_seconds )")
    .eq("playlist_id", id).order("position");
  return {
    playlist,
    items: ((items ?? []) as unknown as Array<{ position: number; tutorials: { id: string; title: string; topic: string; duration_seconds: number | null } | null }>)
      .filter((i) => i.tutorials),
  };
}
