import assert from "node:assert/strict";
import { test } from "node:test";
import { embedUrlFor, parseVideoUrl, watchUrlFor } from "../video-url";

const ALLOWED = ["youtube.com", "youtu.be", "vimeo.com", "ocw.mit.edu"];
const yt = { provider: "youtube", id: "dQw4w9WgXcQ" };

const cases: Array<[string, unknown]> = [
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", yt],
  ["https://youtu.be/dQw4w9WgXcQ", yt],
  ["https://www.youtube.com/shorts/dQw4w9WgXcQ", yt],
  ["https://www.youtube.com/embed/dQw4w9WgXcQ", yt],
  ["https://www.youtube.com/live/dQw4w9WgXcQ?si=x", yt],
  ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", yt],
  ["http://www.youtube.com/watch?v=dQw4w9WgXcQ", yt],
  ["  https://youtu.be/dQw4w9WgXcQ  ", yt],
  ["https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", null],
  ["https://evilyoutube.com/watch?v=dQw4w9WgXcQ", null],
  ["javascript:alert(1)", null],
  ["https://www.youtube.com/watch?v=short", null],
  ["https://user@youtube.com/watch?v=dQw4w9WgXcQ", null],
  ["https://vimeo.com/76979871", { provider: "vimeo", id: "76979871" }],
  ["https://player.vimeo.com/video/76979871", { provider: "vimeo", id: "76979871" }],
  ["https://ocw.mit.edu/courses/x", { provider: "other_allowlisted", url: "https://ocw.mit.edu/courses/x", host: "ocw.mit.edu" }],
  ["http://ocw.mit.edu/courses/x", null],
  ["https://example.org/video", null],
];

for (const [input, expected] of cases) {
  test(`parseVideoUrl(${JSON.stringify(input)})`, () => assert.deepEqual(parseVideoUrl(input, ALLOWED), expected));
}

test("embed and watch URLs come from fixed templates", () => {
  assert.equal(embedUrlFor({ provider: "youtube", id: "dQw4w9WgXcQ" }), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
  assert.equal(embedUrlFor({ provider: "vimeo", id: "76979871" }), "https://player.vimeo.com/video/76979871?dnt=1");
  assert.equal(embedUrlFor({ provider: "other_allowlisted", url: "https://ocw.mit.edu/x", host: "ocw.mit.edu" }), null);
  assert.equal(watchUrlFor({ provider: "youtube", id: "dQw4w9WgXcQ" }), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});
