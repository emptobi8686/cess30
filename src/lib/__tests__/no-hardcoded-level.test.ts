import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

// BLUEPRINT serves every level (decision 0004 / expansion E1). Level wording must come
// from the academic context, never from hard-coded "200 Level" copy.
const ROOT = join(process.cwd(), "src");
const PATTERN = /200[- ]?[Ll]evel|"200 Level"/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

test("no source file hard-codes the 200 level", () => {
  const hits = sourceFiles(ROOT).flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, index) => (PATTERN.test(line) ? [`${relative(ROOT, file)}:${index + 1}`] : []))
  );
  assert.deepEqual(hits, []);
});

test("cohortLabel reads the academic context", async () => {
  const { cohortLabel } = await import("@/components/shared/cohort-label");
  assert.equal(cohortLabel(undefined), null);
  assert.equal(cohortLabel({ levelCode: null, sessionLabel: "2026/2027" }), "Level not set");
  assert.equal(cohortLabel({ levelCode: "300", sessionLabel: "2026/2027" }), "Level 300 · 2026/2027");
});
