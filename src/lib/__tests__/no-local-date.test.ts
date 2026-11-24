import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** BP-037: UI must format dates through src/lib/dates.ts (Africa/Lagos), never the server's locale/timezone. */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("date formatting", () => {
  test("no toLocaleDateString/toLocaleString in UI code", () => {
    const offenders = ["src/app", "src/components"]
      .flatMap((dir) => tsxFiles(join(process.cwd(), dir)))
      .filter((file) => /toLocale(Date)?String\(/.test(readFileSync(file, "utf8")));
    assert.deepEqual(offenders, []);
  });
});
