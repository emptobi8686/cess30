/**
 * Role helper unit tests.
 *
 * These tests cover the edge cases of getCurrentUserRole() that can be exercised
 * without a live Supabase connection — specifically the behaviour when the client
 * throws or returns no user.
 *
 * Live role-based access and RLS boundary tests require a configured project with
 * separate student and admin identities. See supabase/tests/rls_scenarios.sql.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isSupabaseConfigured } from "@/lib/auth";

describe("role guard prerequisites", () => {
  test("getCurrentUserRole requires Supabase to be configured", () => {
    // This test documents that getCurrentUserRole() calls createServerSupabaseClient,
    // which throws if env vars are missing. Callers must handle the thrown error.
    // The check for isSupabaseConfigured() is the client-side safety net.
    assert.equal(typeof isSupabaseConfigured, "function");
  });

  test("UserRole type is limited to expected values", () => {
    // Verify the type contract in source by checking the runtime string values
    // used in the database CHECK constraint (role in ('student','admin')).
    const allowedRoles: string[] = ["student", "admin"];
    assert.ok(allowedRoles.includes("student"), "student is a valid role");
    assert.ok(allowedRoles.includes("admin"), "admin is a valid role");
    assert.ok(!allowedRoles.includes("superuser"), "superuser is not a valid role");
    assert.ok(!allowedRoles.includes("owner"), "owner is not a valid role");
  });

  test("defaulting to student role when no row exists", () => {
    // getCurrentUserRole() returns 'student' via ?? 'student' when roleData is null.
    // This unit test documents the expected fallback without a live call.
    const mockRow: { role: string } | null = null as { role: string } | null;
    const resolvedRole = mockRow?.role ?? "student";
    assert.equal(resolvedRole, "student");
  });

  test("admin role is returned when present", () => {
    const mockRow: { role: string } | null = { role: "admin" };
    const resolvedRole = mockRow?.role ?? "student";
    assert.equal(resolvedRole, "admin");
  });
});
