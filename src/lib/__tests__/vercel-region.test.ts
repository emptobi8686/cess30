import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// The Supabase project runs in eu-central-1 (Frankfurt). Server functions must run in the
// same metro (fra1); otherwise every database round trip crosses the Atlantic (~100 ms each).
test("server functions run next to the database (fra1)", () => {
  const config = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as { regions?: string[] };
  assert.deepEqual(config.regions, ["fra1"]);
});
