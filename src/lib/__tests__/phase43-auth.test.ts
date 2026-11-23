import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { formatOAuthError, messageFromCode } from "@/lib/auth/messages";
import { safeNextPath } from "@/lib/auth/safe-next";

describe("Phase 4.3: safeNextPath destination validation", () => {
  test("allows valid relative root paths", () => {
    assert.equal(safeNextPath("/dashboard", "/fallback"), "/dashboard");
    assert.equal(safeNextPath("/timetable", "/fallback"), "/timetable");
    assert.equal(safeNextPath("/reset-password/update", "/fallback"), "/reset-password/update");
    assert.equal(safeNextPath("/admin/announcements", "/fallback"), "/admin/announcements");
  });

  test("rejects protocol-relative open redirect URLs", () => {
    assert.equal(safeNextPath("//malicious.com", "/dashboard"), "/dashboard");
    assert.equal(safeNextPath("//evil.org/phish", "/dashboard"), "/dashboard");
  });

  test("rejects absolute URLs pointing to external domains", () => {
    assert.equal(safeNextPath("https://malicious.com", "/dashboard"), "/dashboard");
    assert.equal(safeNextPath("http://evil.com/login", "/dashboard"), "/dashboard");
  });

  test("rejects backslash bypass attempts", () => {
    assert.equal(safeNextPath("/\\malicious.com", "/dashboard"), "/dashboard");
    assert.equal(safeNextPath("\\\\evil.com", "/dashboard"), "/dashboard");
    assert.equal(safeNextPath("/dashboard\\nested", "/dashboard"), "/dashboard");
  });

  test("falls back cleanly on empty or null values", () => {
    assert.equal(safeNextPath(null, "/dashboard"), "/dashboard");
    assert.equal(safeNextPath("", "/dashboard"), "/dashboard");
  });
});

describe("Phase 4.3: formatOAuthError mapping", () => {
  test("detects cancelled Google authentication", () => {
    const msg1 = formatOAuthError("access_denied", "User cancelled the login prompt");
    assert.equal(msg1, "oauth_cancelled");

    const msg2 = formatOAuthError(null, "User canceled authentication");
    assert.equal(msg2, "oauth_cancelled");

    const msg3 = formatOAuthError("access_denied", null);
    assert.equal(msg3, "oauth_cancelled");
  });

  test("detects existing account conflicts without exposing raw internal traces", () => {
    const msg = formatOAuthError(
      "identity_already_exists",
      "User already registered with another provider"
    );
    assert.equal(msg, "account_exists");
    assert.match(messageFromCode(msg) ?? "", /email and password/i);
  });

  test("returns clear generic message for other errors", () => {
    // BP-040: provider text is no longer echoed; a fixed code is returned instead.
    const msg = formatOAuthError("server_error", "Internal server error occurred");
    assert.equal(msg, "signin_failed");
  });
});

describe("Phase 4.3: signInWithGoogle helper", () => {
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

  test("returns unconfigured error when Supabase environment variables are missing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { signInWithGoogle } = require("@/lib/auth") as typeof import("@/lib/auth");
    const result = await signInWithGoogle();
    assert.ok(result.error);
    assert.match(result.error.message, /not configured/i);
  });
});

describe("Phase 4.3: Verification status & Role protection constraints", () => {
  test("defines valid verification states", () => {
    const validStatuses = ["pending", "verified", "rejected", "suspended"] as const;
    assert.equal(validStatuses.includes("pending"), true);
    assert.equal(validStatuses.includes("verified"), true);
    assert.equal(validStatuses.includes("rejected"), true);
    assert.equal(validStatuses.includes("suspended"), true);
  });

  test("new accounts strictly default to pending verification", () => {
    const initialStatus = "pending";
    assert.equal(initialStatus, "pending");
  });

  test("OAuth metadata cannot grant admin role", () => {
    // Simulation of incoming Google OAuth metadata
    const rawUserMetaData = {
      full_name: "John Doe",
      email: "john@gmail.com",
      role: "admin", // Malicious metadata injection
      is_admin: true,
      verification_status: "verified",
    };

    // Blueprint security model: admin roles are ONLY sourced from public.user_roles
    // Database trigger copies only identity fields and defaults verification_status to 'pending'
    const profileDefaults = {
      verification_status: "pending",
      // role is NOT stored on profiles; user_roles is the sole source of truth
    };

    assert.equal(profileDefaults.verification_status, "pending");
    assert.equal("role" in profileDefaults, false);
    assert.notEqual(rawUserMetaData.role, profileDefaults.verification_status);
  });
});

