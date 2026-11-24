import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { toSafeExternalHref } from "@/lib/safe-links";

describe("toSafeExternalHref", () => {
  test("rejects script and non-https schemes", () => {
    assert.equal(toSafeExternalHref("javascript:alert(1)"), null);
    assert.equal(toSafeExternalHref("data:text/html,hi"), null);
    assert.equal(toSafeExternalHref("http://example.com"), null);
  });
  test("rejects credentials, relative and empty values", () => {
    assert.equal(toSafeExternalHref("https://user:pw@example.com"), null);
    assert.equal(toSafeExternalHref("/relative/path"), null);
    assert.equal(toSafeExternalHref(""), null);
    assert.equal(toSafeExternalHref(null), null);
    assert.equal(toSafeExternalHref(undefined), null);
  });
  test("accepts and normalises https URLs", () => {
    assert.equal(toSafeExternalHref("https://drive.google.com/x"), "https://drive.google.com/x");
    assert.equal(toSafeExternalHref("  https://example.com/a?b=1  "), "https://example.com/a?b=1");
  });
});
