import assert from "node:assert/strict";
import { test } from "node:test";
import { buildContentDisposition, parseFileMode, SIGNED_URL_TTL } from "../disposition";

test("preview is inline, download uses the safe filename", () => {
  assert.deepEqual(buildContentDisposition("x.pdf", "preview"), { download: false });
  assert.deepEqual(buildContentDisposition("../a\u0000b.pdf", "download"), { download: "a b.pdf" });
});

test("mode defaults to download; TTLs match the plan", () => {
  assert.equal(parseFileMode(null), "download");
  assert.equal(parseFileMode("preview"), "preview");
  assert.equal(parseFileMode("weird"), "download");
  assert.deepEqual(SIGNED_URL_TTL, { download: 120, preview: 300 });
});
