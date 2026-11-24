/** Pure helpers for provider metadata (unit-tested; no network). */

/** ISO-8601 duration (YouTube Data API) → seconds, e.g. PT1H2M3S → 3723. */
export function parseIsoDuration(value: string): number | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value);
  if (!m || value === "P" || value === "PT") return null;
  const [, d, h, min, s] = m.map((x) => (x ? Number(x) : 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

export const OEMBED_ENDPOINT = "https://www.youtube.com/oembed";
export const DATA_API_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";
export const ALLOWED_METADATA_HOSTS = ["www.youtube.com", "www.googleapis.com"] as const;

export type VideoMetadata = { title: string | null; author: string | null; durationSeconds: number | null; embeddable: boolean | null };

const EMPTY: VideoMetadata = { title: null, author: null, durationSeconds: null, embeddable: null };

/**
 * YouTube metadata from fixed endpoints only: oEmbed always (401/404 → not embeddable),
 * the Data API only with an approved server-side key. 5 s timeout; never throws.
 */
export async function fetchYouTubeMetadata(
  id: string,
  options: { fetchImpl?: typeof fetch; apiKey?: string | null } = {}
): Promise<VideoMetadata> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return EMPTY;
  const fetchImpl = options.fetchImpl ?? fetch;
  const result: VideoMetadata = { ...EMPTY };
  const watch = `https://www.youtube.com/watch?v=${id}`;
  try {
    const res = await fetchImpl(`${OEMBED_ENDPOINT}?url=${encodeURIComponent(watch)}&format=json`, { signal: AbortSignal.timeout(5000) });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      result.embeddable = false;
    } else if (res.ok) {
      const body = (await res.json()) as { title?: unknown; author_name?: unknown };
      result.title = typeof body.title === "string" ? body.title.slice(0, 160) : null;
      result.author = typeof body.author_name === "string" ? body.author_name.slice(0, 120) : null;
      result.embeddable = true;
    }
  } catch {
    // network failure: leave unknown
  }
  if (options.apiKey) {
    try {
      const res = await fetchImpl(`${DATA_API_ENDPOINT}?part=contentDetails,status&id=${id}&key=${encodeURIComponent(options.apiKey)}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const body = (await res.json()) as { items?: Array<{ contentDetails?: { duration?: string }; status?: { embeddable?: boolean } }> };
        const item = body.items?.[0];
        if (item?.contentDetails?.duration) result.durationSeconds = parseIsoDuration(item.contentDetails.duration);
        if (typeof item?.status?.embeddable === "boolean") result.embeddable = item.status.embeddable;
      }
    } catch {
      // optional enrichment only
    }
  }
  return result;
}
