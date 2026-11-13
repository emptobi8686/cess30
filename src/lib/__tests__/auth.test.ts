/**
 * Auth helper unit tests.
 *
 * These tests run in-process with Node's built-in test runner (tsx --test).
 * They cover the pure helper logic (isSupabaseConfigured, signInWithEmail, etc.)
 * using mocked environment variables. No live Supabase calls are made.
 *
 * Live authentication, session persistence, and RLS boundary verification require
 * a configured Supabase project and separate student/admin identities — see
 * supabase/tests/rls_scenarios.sql and AI_HANDOFF.md.
 */
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Helpers that need env vars set before import
// ---------------------------------------------------------------------------

describe("isSupabaseConfigured", () => {
  test("returns false when both env vars are absent", () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Re-require to pick up the new env state
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isSupabaseConfigured } = require("@/lib/auth") as typeof import("@/lib/auth");
    assert.equal(isSupabaseConfigured(), false);

    if (previousUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnon !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnon;
  });

  test("returns true when both env vars are present", () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isSupabaseConfigured } = require("@/lib/auth") as typeof import("@/lib/auth");
    assert.equal(isSupabaseConfigured(), true);

    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;

    if (previousAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnon;
  });
});

describe("signInWithEmail — unconfigured guard", () => {
  let savedUrl: string | undefined;
  let savedAnon: string | undefined;

  before(() => {
    savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    savedAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  after(() => {
    if (savedUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedAnon !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedAnon;
  });

  test("returns a descriptive error when Supabase is not configured", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { signInWithEmail } = require("@/lib/auth") as typeof import("@/lib/auth");
    const result = await signInWithEmail("student@example.com", "password123");
    assert.ok(result.error, "Expected an error object");
    assert.match(result.error.message, /not configured/i);
  });
});

describe("signUpWithEmail — unconfigured guard", () => {
  let savedUrl: string | undefined;
  let savedAnon: string | undefined;

  before(() => {
    savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    savedAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  after(() => {
    if (savedUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedAnon !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedAnon;
  });

  test("returns a descriptive error when Supabase is not configured", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { signUpWithEmail } = require("@/lib/auth") as typeof import("@/lib/auth");
    const result = await signUpWithEmail("student@example.com", "password123", {
      full_name: "Test Student",
      matric_number: "19/0001CE",
    });
    assert.ok(result.error, "Expected an error object");
    assert.match(result.error.message, /not configured/i);
  });
});

describe("resetPassword — unconfigured guard", () => {
  let savedUrl: string | undefined;
  let savedAnon: string | undefined;

  before(() => {
    savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    savedAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  after(() => {
    if (savedUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedAnon !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedAnon;
  });

  test("returns a descriptive error when Supabase is not configured", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resetPassword } = require("@/lib/auth") as typeof import("@/lib/auth");
    const result = await resetPassword("student@example.com");
    assert.ok(result.error, "Expected an error object");
    assert.match(result.error.message, /not configured/i);
  });
});

describe("signOutUser — unconfigured guard", () => {
  let savedUrl: string | undefined;
  let savedAnon: string | undefined;

  before(() => {
    savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    savedAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  after(() => {
    if (savedUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedAnon !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedAnon;
  });

  test("returns a descriptive error when Supabase is not configured", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { signOutUser } = require("@/lib/auth") as typeof import("@/lib/auth");
    const result = await signOutUser();
    assert.ok(result.error, "Expected an error object");
    assert.match(result.error.message, /not configured/i);
  });
});
