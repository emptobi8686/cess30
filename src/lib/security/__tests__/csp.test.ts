import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildCsp, securityHeaders } from "@/lib/security/csp";

const directive = (csp: string, name: string) =>
  csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? "";

describe("buildCsp (BP-053)", () => {
  const csp = buildCsp({ supabaseUrl: "https://x.supabase.co" });

  test("blocks framing and plugins", () => {
    assert.equal(directive(csp, "frame-ancestors"), "frame-ancestors 'none'");
    assert.equal(directive(csp, "frame-src"), "frame-src 'none'");
    assert.equal(directive(csp, "object-src"), "object-src 'none'");
    assert.equal(directive(csp, "base-uri"), "base-uri 'self'");
  });

  test("allows Supabase REST, Realtime and Storage only", () => {
    assert.equal(directive(csp, "connect-src"), "connect-src 'self' https://x.supabase.co wss://x.supabase.co");
    assert.ok(directive(csp, "img-src").includes("https://x.supabase.co"));
  });

  test("form posts only to self, Google OAuth and Supabase", () => {
    assert.equal(directive(csp, "form-action"), "form-action 'self' https://accounts.google.com https://x.supabase.co");
  });

  test("development adds eval and the HMR websocket only in dev", () => {
    const dev = buildCsp({ supabaseUrl: "http://127.0.0.1:54321", development: true });
    assert.ok(directive(dev, "script-src").includes("'unsafe-eval'"));
    assert.ok(directive(dev, "connect-src").includes("ws:"));
    assert.ok(!directive(csp, "script-src").includes("'unsafe-eval'"));
  });

  test("extensions add hosts without loosening to wildcards", () => {
    const extended = buildCsp({ supabaseUrl: "https://x.supabase.co", extraFrameSrc: ["https://www.youtube-nocookie.com"] });
    assert.equal(directive(extended, "frame-src"), "frame-src https://www.youtube-nocookie.com");
    assert.ok(!extended.includes(" * "));
  });
});

describe("securityHeaders", () => {
  test("includes the standard hardening headers", () => {
    const names = securityHeaders({ supabaseUrl: "https://x.supabase.co", production: true }).map((h) => h.key);
    for (const name of [
      "Content-Security-Policy",
      "Referrer-Policy",
      "X-Content-Type-Options",
      "Permissions-Policy",
      "Strict-Transport-Security",
    ]) {
      assert.ok(names.includes(name), name);
    }
    const devNames = securityHeaders({ supabaseUrl: "https://x.supabase.co", production: false }).map((h) => h.key);
    assert.ok(!devNames.includes("Strict-Transport-Security"));
  });
});

describe("library PDF preview framing (P8)", () => {
  test("app headers allow frames only from self and the project's Supabase storage", () => {
    const headers = securityHeaders({ supabaseUrl: "https://x.supabase.co", production: true });
    const csp = headers.find((h) => h.key === "Content-Security-Policy")!.value;
    assert.ok(directive(csp, "frame-src").startsWith("frame-src 'self' https://x.supabase.co"));
    assert.equal(directive(csp, "frame-ancestors"), "frame-ancestors 'none'");
  });
});

describe("tutorial embeds (P9)", () => {
  test("frames allow the privacy-enhanced YouTube host and Vimeo player only", () => {
    const headers = securityHeaders({ supabaseUrl: "https://x.supabase.co", production: true });
    const csp = headers.find((h) => h.key === "Content-Security-Policy")!.value;
    const frames = directive(csp, "frame-src");
    assert.ok(frames.includes("https://www.youtube-nocookie.com"));
    assert.ok(frames.includes("https://player.vimeo.com"));
    assert.ok(!/(^| )https:\/\/www\.youtube\.com( |$)/.test(frames));
    assert.ok(directive(csp, "img-src").includes("https://i.ytimg.com"));
  });
});
