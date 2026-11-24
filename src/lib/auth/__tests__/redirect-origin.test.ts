import assert from "node:assert/strict";
import { test } from "node:test";
import { authCallbackUrl, authRedirectOrigin, postSignInPath } from "@/lib/auth/redirect-origin";

test("the current page origin wins over the configured site URL", () => {
  assert.equal(authRedirectOrigin("https://cess30-abc.vercel.app", "https://blueprint.example"), "https://cess30-abc.vercel.app");
  assert.equal(authRedirectOrigin(undefined, "https://blueprint.example/"), "https://blueprint.example");
  assert.equal(authRedirectOrigin(null, null), "http://localhost:3000");
});

test("callback URL keeps next as an encoded relative path", () => {
  assert.equal(authCallbackUrl("https://x.app", "/quests?tab=open"), "https://x.app/auth/confirm?next=%2Fquests%3Ftab%3Dopen");
});

test("new Google users without a matric number go to the welcome step", () => {
  assert.equal(postSignInPath("/dashboard", { matric_number: null }), "/welcome?next=%2Fdashboard");
  assert.equal(postSignInPath("/dashboard", { matric_number: "190408012" }), "/dashboard");
  assert.equal(postSignInPath("/dashboard", null), "/dashboard");
});
