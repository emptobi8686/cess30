import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { AUTH_MESSAGES, formatOAuthError, messageFromCode } from "@/lib/auth/messages";

describe("messageFromCode (BP-040)", () => {
  test("known codes map to fixed copy", () => {
    for (const code of Object.keys(AUTH_MESSAGES)) {
      assert.ok((messageFromCode(code) ?? "").length > 0, code);
    }
  });
  test("arbitrary query text is never rendered", () => {
    assert.equal(messageFromCode("<script>alert(1)</script>"), null);
    assert.equal(messageFromCode("Your account was hacked, call +234…"), null);
    assert.equal(messageFromCode(undefined), null);
    assert.equal(messageFromCode(["oauth_cancelled"]), "Google sign-in was cancelled. Please try again when you are ready.");
  });
});

describe("formatOAuthError returns codes, not provider text", () => {
  test("cancellations", () => {
    assert.equal(formatOAuthError("access_denied", "User cancelled the login prompt"), "oauth_cancelled");
    assert.equal(formatOAuthError(null, "User canceled authentication"), "oauth_cancelled");
  });
  test("existing accounts", () => {
    assert.equal(formatOAuthError("identity_already_exists", "User already registered"), "account_exists");
  });
  test("anything else is a generic sign-in failure", () => {
    assert.equal(formatOAuthError("server_error", "Internal server error occurred"), "signin_failed");
  });
});
