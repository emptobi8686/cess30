#!/usr/bin/env node
// Runs the node:test suite through tsx and fails on ANY "not ok" line.
// Node 22 reports a suite whose describe() callback throws as "not ok" but still
// exits 0 with "# fail 0", which would let CI pass with broken tests.
import { spawn } from "node:child_process";

const args = ["tsx", "--test", "--test-reporter=tap", ...(process.argv.length > 2 ? process.argv.slice(2) : ["src/**/*.test.ts"])];
const child = spawn("npx", args, { stdio: ["inherit", "pipe", "inherit"] });

let failures = 0;
let buffer = "";
child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  buffer += chunk.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) if (/^\s*not ok\b/.test(line)) failures += 1;
});

child.on("close", (code) => {
  if (/^\s*not ok\b/.test(buffer)) failures += 1;
  if (failures > 0) {
    console.error(`\n${failures} "not ok" result(s) reported; failing the run.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
