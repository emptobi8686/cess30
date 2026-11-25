import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Base UI contract guards (BP-010):
 *   - Menu.GroupLabel (DropdownMenuLabel) throws at render outside Menu.Group.
 *   - Triggers render their own <button>; nesting a <Button> creates button-in-button.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

const files = sourceFiles(join(process.cwd(), "src")).filter((f) => !f.includes("/components/ui/"));

describe("dropdown menu usage", () => {
  test("every DropdownMenuLabel is inside a DropdownMenuGroup", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      let index = source.indexOf("<DropdownMenuLabel");
      while (index !== -1) {
        const before = source.slice(0, index);
        const opened = before.split("<DropdownMenuGroup").length - 1;
        const closed = before.split("</DropdownMenuGroup>").length - 1;
        assert.ok(opened > closed, `${file}: DropdownMenuLabel outside DropdownMenuGroup`);
        index = source.indexOf("<DropdownMenuLabel", index + 1);
      }
    }
  });

  test("no trigger wraps a <Button> child (use the render prop)", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.ok(
        !/<(DropdownMenuTrigger|DialogTrigger|SheetTrigger)>\s*<Button/.test(source),
        `${file}: trigger wraps a Button; use render={<Button …/>}`
      );
    }
  });
});

describe("link semantics (BP-036)", () => {
  test("no <Link> wraps a <Button> (use Button render={<Link/>})", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.ok(!/<Link\b[^>]*>\s*<Button\b/.test(source), `${file}: <Link> wraps a <Button>`);
    }
  });
});

describe("Base UI Button rendering links", () => {
  test("Button render={<Link/>} declares nativeButton={false}", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/<Button\b[^]*?render=\{<Link/g)) {
        const tag = match[0];
        if (tag.includes("<Button", 1)) continue; // matched across elements
        if (/\/>|<\//.test(tag)) continue; // the Button closed before this render prop: another element's
        assert.ok(tag.includes("nativeButton={false}"), `${file}: Button renders a Link without nativeButton={false}`);
      }
    }
  });
});
