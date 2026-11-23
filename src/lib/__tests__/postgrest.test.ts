import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildVerificationSearchFilter, escapeIlikeValue } from "@/lib/postgrest";

describe("escapeIlikeValue", () => {
  test("quotes the value and escapes PostgREST specials", () => {
    assert.equal(escapeIlikeValue('a"b'), '"a\\"b"');
  });
  test("LIKE wildcards in user input become literals", () => {
    // % → \% for LIKE, then the backslash is escaped for PostgREST quoting → \\%
    assert.equal(escapeIlikeValue("%"), '"\\\\%"');
    assert.equal(escapeIlikeValue("_"), '"\\\\_"');
  });
});

describe("buildVerificationSearchFilter", () => {
  test("commas and parentheses cannot break out of the filter", () => {
    const filter = buildVerificationSearchFilter("ab,c)");
    assert.ok(filter);
    assert.equal(
      filter,
      'full_name.ilike."%ab,c)%",matric_number.ilike."%ab,c)%"'
    );
  });
  test("empty and oversized queries produce no filter", () => {
    assert.equal(buildVerificationSearchFilter(""), null);
    assert.equal(buildVerificationSearchFilter("   "), null);
    assert.equal(buildVerificationSearchFilter("x".repeat(61)), null);
  });
});
