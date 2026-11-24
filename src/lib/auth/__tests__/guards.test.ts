import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolveAccess } from "@/lib/auth/access";
import { AccessDeniedError, assertAccess, ACCESS_DENIED_MESSAGE } from "@/lib/auth/guards";

function ctx(status: string, roles: string[] = []) {
  return resolveAccess("u1", roles.map((role) => ({ role })), { verification_status: status });
}

function deniedWith(code: string) {
  return (error: unknown) =>
    error instanceof AccessDeniedError && error.code === code && error.message === ACCESS_DENIED_MESSAGE;
}

describe("assertAccess", () => {
  test("null context is unauthenticated", () => {
    assert.throws(() => assertAccess(null, "read"), deniedWith("unauthenticated"));
  });

  test("non-admin needing admin is forbidden", () => {
    assert.throws(() => assertAccess(ctx("verified"), "admin"), deniedWith("forbidden"));
  });

  test("suspended student needing read is suspended", () => {
    assert.throws(() => assertAccess(ctx("suspended"), "read"), deniedWith("suspended"));
  });

  test("pending student needing full is forbidden", () => {
    assert.throws(() => assertAccess(ctx("pending"), "full"), deniedWith("forbidden"));
  });

  test("rejected student may read", () => {
    assert.equal(assertAccess(ctx("rejected"), "read").verificationStatus, "rejected");
  });

  test("verified student with full need passes", () => {
    assert.equal(assertAccess(ctx("verified"), "full").userId, "u1");
  });

  test("admin who is still pending as a student passes admin checks", () => {
    assert.equal(assertAccess(ctx("pending", ["student", "admin"]), "admin").isAdmin, true);
  });

  test("admin who is pending as a student is still limited for full student access", () => {
    assert.throws(() => assertAccess(ctx("pending", ["admin"]), "full"), deniedWith("forbidden"));
  });
});

describe("staff guard", () => {
  test("allows admins and course reps, refuses other students", () => {
    const rep = resolveAccess("u1", [{ role: "student" }], { verification_status: "verified" }, [
      { capability: "level_coordinator", level_code: "200" },
    ]);
    assert.equal(assertAccess(rep, "staff").userId, "u1");
    assert.equal(assertAccess(ctx("verified", ["admin"]), "staff").isAdmin, true);
    assert.throws(() => assertAccess(ctx("verified"), "staff"), AccessDeniedError);
    assert.throws(() => assertAccess(rep, "admin"), AccessDeniedError);
  });
});
