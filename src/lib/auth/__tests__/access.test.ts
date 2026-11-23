import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolveAccess, studentAccessLevel } from "@/lib/auth/access";

describe("resolveAccess", () => {
  test("admin+student rows resolve isAdmin true (BP-006)", () => {
    const ctx = resolveAccess("u1", [{ role: "student" }, { role: "admin" }], {
      verification_status: "verified",
    });
    assert.equal(ctx.isAdmin, true);
    assert.deepEqual([...ctx.roles].sort(), ["admin", "student"]);
  });

  test("student-only rows resolve isAdmin false", () => {
    const ctx = resolveAccess("u1", [{ role: "student" }], { verification_status: "verified" });
    assert.equal(ctx.isAdmin, false);
  });

  test("unknown role values are ignored", () => {
    const ctx = resolveAccess("u1", [{ role: "superuser" }], { verification_status: "verified" });
    assert.deepEqual(ctx.roles, []);
    assert.equal(ctx.isAdmin, false);
  });

  test("missing profile resolves to pending", () => {
    assert.equal(resolveAccess("u1", [], null).verificationStatus, "pending");
  });

  test("unknown status resolves to pending", () => {
    assert.equal(
      resolveAccess("u1", [], { verification_status: "weird" }).verificationStatus,
      "pending"
    );
  });

  test("userId is carried through", () => {
    assert.equal(resolveAccess("abc", [], null).userId, "abc");
  });
});

describe("studentAccessLevel", () => {
  test("maps every verification status", () => {
    const cases = [
      ["verified", "full"],
      ["pending", "read"],
      ["rejected", "read"],
      ["suspended", "none"],
    ] as const;
    for (const [status, level] of cases) {
      assert.equal(
        studentAccessLevel(resolveAccess("u", [], { verification_status: status })),
        level,
        status
      );
    }
  });
});

describe("staff capabilities", () => {
  test("collects coordinated levels and ignores unknown capabilities", () => {
    const ctx = resolveAccess("u1", [{ role: "student" }], { verification_status: "verified" }, [
      { capability: "level_coordinator", level_code: "300" },
      { capability: "level_coordinator", level_code: "200" },
      { capability: "wizard", level_code: null },
    ]);
    assert.deepEqual(ctx.staffLevels, ["200", "300"]);
    assert.equal(ctx.isStaff, true);
    assert.equal(ctx.isAdmin, false);
  });

  test("a department_admin capability counts as admin", () => {
    const ctx = resolveAccess("u1", [], { verification_status: "verified" }, [{ capability: "department_admin", level_code: null }]);
    assert.equal(ctx.isAdmin, true);
    assert.equal(ctx.isStaff, true);
  });

  test("no capabilities means not staff", () => {
    const ctx = resolveAccess("u1", [{ role: "student" }], { verification_status: "verified" });
    assert.equal(ctx.isStaff, false);
    assert.deepEqual(ctx.staffLevels, []);
  });
});
