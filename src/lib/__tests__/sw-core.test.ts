import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const sw = require(join(process.cwd(), "public/sw-core.js")) as {
  CACHE_VERSION: string;
  getSafeTarget(value: unknown): string;
  parsePushPayload(data: unknown): { title: string; body: string; tag?: string; target: string };
};

describe("service worker core (BP-011)", () => {
  test("click targets stay in-app", () => {
    assert.equal(sw.getSafeTarget("https://evil.example"), "/notifications");
    assert.equal(sw.getSafeTarget("//evil.example"), "/notifications");
    assert.equal(sw.getSafeTarget("/\\evil.example"), "/notifications");
    assert.equal(sw.getSafeTarget("/\tx"), "/notifications");
    assert.equal(sw.getSafeTarget(42), "/notifications");
    assert.equal(sw.getSafeTarget("/quests?x=1"), "/quests?x=1");
  });

  test("missing or malformed payloads use defaults", () => {
    assert.equal(sw.parsePushPayload(null).title, "BLUEPRINT");
    assert.equal(sw.parsePushPayload({ json: () => ({ title: 5 }) }).title, "BLUEPRINT");
    assert.equal(sw.parsePushPayload({ json: () => { throw new Error("bad"); } }).body, "You have a new update.");
  });

  test("valid payloads are passed through with a safe target", () => {
    const parsed = sw.parsePushPayload({
      json: () => ({ title: "Lecture reminder", body: "GET209 starts soon", notificationId: "n1", actionUrl: "/timetable" }),
    });
    assert.deepEqual(parsed, { title: "Lecture reminder", body: "GET209 starts soon", tag: "n1", target: "/timetable" });
  });

  test("cache version is bumped from the stripped v1", () => {
    assert.equal(sw.CACHE_VERSION, "blueprint-static-v2");
  });
});
