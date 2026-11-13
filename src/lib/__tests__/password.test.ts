import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "@/lib/password";

describe("new password validation", () => {
  test("accepts a matching password at the minimum length", () => {
    const password = "a".repeat(MIN_PASSWORD_LENGTH);
    assert.equal(validateNewPassword(password, password), null);
  });

  test("rejects an empty password", () => {
    assert.match(validateNewPassword("", "") ?? "", /required/i);
  });

  test("rejects a password shorter than the minimum", () => {
    const password = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    assert.match(validateNewPassword(password, password) ?? "", /at least/i);
  });

  test("requires confirmation", () => {
    assert.match(
      validateNewPassword("long-enough-password", "") ?? "",
      /confirm/i
    );
  });

  test("rejects mismatched confirmation", () => {
    assert.match(
      validateNewPassword("long-enough-password", "different-password") ?? "",
      /do not match/i
    );
  });

  test("does not silently trim passwords", () => {
    const password = "  spaced password  ";
    assert.equal(validateNewPassword(password, password), null);
  });
});
