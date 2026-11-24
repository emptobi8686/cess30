/**
 * Strict video URL parsing (P9). Only provider IDs are kept for embeds; embed and
 * watch URLs are rebuilt from fixed templates, so nothing a user pastes is ever rendered.
 */

export type ParsedVideo =
  | { provider: "youtube"; id: string }
  | { provider: "vimeo"; id: string }
  | { provider: "other_allowlisted"; url: string; host: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
const YOUTUBE_HOSTS = ["youtube.com", "youtu.be"];
const VIMEO_HOSTS = ["vimeo.com"];

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function parseVideoUrl(input: string, allowedDomains: string[]): ParsedVideo | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const allowed = allowedDomains.map((d) => d.toLowerCase());
  const isAllowed = allowed.some((d) => hostMatches(host, d));
  if (!isAllowed) return null;

  const isYouTube = YOUTUBE_HOSTS.some((d) => hostMatches(host, d));
  const isVimeo = VIMEO_HOSTS.some((d) => hostMatches(host, d));
  // http is tolerated (and upgraded) only for the two video providers.
  if (url.protocol !== "https:" && !(url.protocol === "http:" && (isYouTube || isVimeo))) return null;

  if (isYouTube) {
    const parts = url.pathname.split("/").filter(Boolean);
    let id: string | null = null;
    if (hostMatches(host, "youtu.be")) id = parts[0] ?? null;
    else if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (["shorts", "embed", "live"].includes(parts[0] ?? "")) id = parts[1] ?? null;
    return id && YOUTUBE_ID.test(id) ? { provider: "youtube", id } : null;
  }
  if (isVimeo) {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts[0] === "video" ? parts[1] : parts[0];
    return id && VIMEO_ID.test(id) ? { provider: "vimeo", id } : null;
  }
  url.hash = "";
  return { provider: "other_allowlisted", url: url.toString(), host };
}

export function embedUrlFor(v: ParsedVideo): string | null {
  if (v.provider === "youtube") return `https://www.youtube-nocookie.com/embed/${v.id}?rel=0`;
  if (v.provider === "vimeo") return `https://player.vimeo.com/video/${v.id}?dnt=1`;
  return null;
}

/** Canonical link-out (what is stored as external_url). */
export function watchUrlFor(v: ParsedVideo): string {
  if (v.provider === "youtube") return `https://www.youtube.com/watch?v=${v.id}`;
  if (v.provider === "vimeo") return `https://vimeo.com/${v.id}`;
  return v.url;
}
