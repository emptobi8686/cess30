import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  avatarObjectPath,
  extensionForMime,
  objectPathFromPublicUrl,
  supabaseImagePattern,
  validateAvatarFile,
} from "@/features/profile/avatar";

describe("avatar helpers (BP-026)", () => {
  test("extension comes from the MIME type, never the filename", () => {
    assert.equal(extensionForMime("image/png"), "png");
    assert.equal(extensionForMime("image/jpeg"), "jpg");
    assert.equal(extensionForMime("image/svg+xml"), null);
    assert.equal(extensionForMime("text/html"), null);
  });

  test("object path is inside the user's folder", () => {
    assert.match(avatarObjectPath("u1", "image/png"), /^u1\/[0-9a-f-]{36}\.png$/);
    assert.throws(() => avatarObjectPath("u1", "image/svg+xml"));
  });

  test("public URL → object path", () => {
    assert.equal(
      objectPathFromPublicUrl("https://x.supabase.co/storage/v1/object/public/profile-pictures/u1/a.png", "profile-pictures"),
      "u1/a.png"
    );
    assert.equal(objectPathFromPublicUrl("https://lh3.googleusercontent.com/a/xyz", "profile-pictures"), null);
    assert.equal(objectPathFromPublicUrl("not a url", "profile-pictures"), null);
  });

  test("file validation enforces type and the 5 MB limit", () => {
    assert.equal(validateAvatarFile({ type: "image/png", size: 4.5 * 1024 * 1024 }), null);
    assert.equal(validateAvatarFile({ type: "image/png", size: 6 * 1024 * 1024 }), "Profile picture must be smaller than 5 MB.");
    assert.equal(validateAvatarFile({ type: "image/svg+xml", size: 100 }), "Only JPEG, PNG, WebP and GIF images are allowed.");
  });

  test("next/image remote pattern for the project's storage host", () => {
    assert.deepEqual(supabaseImagePattern("https://abc.supabase.co"), {
      protocol: "https",
      hostname: "abc.supabase.co",
      port: "",
      pathname: "/storage/v1/object/public/profile-pictures/**",
    });
    assert.deepEqual(supabaseImagePattern("http://127.0.0.1:54321"), {
      protocol: "http",
      hostname: "127.0.0.1",
      port: "54321",
      pathname: "/storage/v1/object/public/profile-pictures/**",
    });
    assert.equal(supabaseImagePattern(undefined), null);
  });
});
