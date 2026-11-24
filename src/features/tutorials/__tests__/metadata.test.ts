import assert from "node:assert/strict";
import { test } from "node:test";
import { ALLOWED_METADATA_HOSTS, fetchYouTubeMetadata, parseIsoDuration } from "../metadata-core";

test("ISO durations", () => {
  assert.equal(parseIsoDuration("PT4M13S"), 253);
  assert.equal(parseIsoDuration("PT1H2M3S"), 3723);
  assert.equal(parseIsoDuration("nonsense"), null);
});

function fakeFetch(responses: Record<string, { status: number; body?: unknown }>, seen: string[]): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    seen.push(url);
    const key = Object.keys(responses).find((k) => url.startsWith(k)) ?? "";
    const r = responses[key] ?? { status: 500 };
    return new Response(r.body ? JSON.stringify(r.body) : null, { status: r.status });
  }) as typeof fetch;
}

test("oEmbed 401 means not embeddable; the Data API is skipped without a key", async () => {
  const seen: string[] = [];
  const meta = await fetchYouTubeMetadata("dQw4w9WgXcQ", { fetchImpl: fakeFetch({ "https://www.youtube.com/oembed": { status: 401 } }, seen) });
  assert.equal(meta.embeddable, false);
  assert.equal(seen.length, 1);
  assert.ok(seen.every((u) => (ALLOWED_METADATA_HOSTS as readonly string[]).includes(new URL(u).host)));
});

test("with a key, duration comes from the Data API; only fixed hosts are called", async () => {
  const seen: string[] = [];
  const meta = await fetchYouTubeMetadata("dQw4w9WgXcQ", {
    apiKey: "k",
    fetchImpl: fakeFetch({
      "https://www.youtube.com/oembed": { status: 200, body: { title: "SFDs", author_name: "Dept" } },
      "https://www.googleapis.com/youtube/v3/videos": { status: 200, body: { items: [{ contentDetails: { duration: "PT4M13S" }, status: { embeddable: true } }] } },
    }, seen),
  });
  assert.deepEqual(meta, { title: "SFDs", author: "Dept", durationSeconds: 253, embeddable: true });
  assert.ok(seen.every((u) => (ALLOWED_METADATA_HOSTS as readonly string[]).includes(new URL(u).host)));
});

test("invalid ids never trigger a request", async () => {
  const seen: string[] = [];
  await fetchYouTubeMetadata("../../x", { fetchImpl: fakeFetch({}, seen) });
  assert.equal(seen.length, 0);
});
