import assert from "node:assert/strict";
import { test } from "node:test";
import { detectMime, readZipEntryNames, safeDisplayFilename, validateLibraryUpload } from "../file-validation";

const enc = new TextEncoder();
const bytes = (...parts: Array<string | number[]>) =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...enc.encode(p)] : p)));

/** Minimal "stored" zip (no compression) with the given entry names, enough for central-directory parsing. */
function zip(names: string[]): Uint8Array {
  const out: number[] = [];
  const central: number[] = [];
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  for (const name of names) {
    const nameBytes = [...enc.encode(name)];
    const offset = out.length;
    out.push(...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(0), ...u32(0), ...u16(nameBytes.length), ...u16(0), ...nameBytes);
    central.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(0), ...u32(0),
      ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameBytes);
  }
  const cdOffset = out.length;
  out.push(...central);
  out.push(...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(names.length), ...u16(names.length), ...u32(central.length), ...u32(cdOffset), ...u16(0));
  return Uint8Array.from(out);
}

const PDF = bytes("%PDF-1.7\n1 0 obj\n");
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const OLE = bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
const PPTX = zip(["[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml"]);
const DOCX = zip(["[Content_Types].xml", "word/document.xml"]);
const PPTM = zip(["[Content_Types].xml", "ppt/presentation.xml", "ppt/vbaProject.bin"]);
const FAKE_PDF = bytes("<!DOCTYPE html><html><script>alert(1)</script></html>");

const MB = 1024 * 1024;
const v = (declaredMime: string, file: Uint8Array, sizeBytes = file.length) =>
  validateLibraryUpload({ declaredMime, sizeBytes, head: file, zipEntryNames: readZipEntryNames(file) ?? undefined });

test("real files are accepted with the extension from their content", () => {
  assert.deepEqual(v("application/pdf", PDF), { ok: true, mime: "application/pdf", ext: "pdf" });
  assert.deepEqual(v("image/png", PNG), { ok: true, mime: "image/png", ext: "png" });
  assert.deepEqual(v("image/jpeg", JPEG), { ok: true, mime: "image/jpeg", ext: "jpg" });
  assert.deepEqual(v("application/vnd.openxmlformats-officedocument.presentationml.presentation", PPTX).ok, true);
  assert.equal((v("application/vnd.openxmlformats-officedocument.wordprocessingml.document", DOCX) as { ext: string }).ext, "docx");
  assert.equal((v("application/vnd.ms-powerpoint", OLE) as { ext: string }).ext, "ppt");
  assert.equal((v("text/plain", bytes("Week 3 reading list\n- Beams\n")) as { ext: string }).ext, "txt");
});

test("HTML renamed to .pdf is a content mismatch", () => {
  assert.deepEqual(v("application/pdf", FAKE_PDF), { ok: false, reason: "content_mismatch" });
  assert.deepEqual(v("text/plain", FAKE_PDF), { ok: false, reason: "content_mismatch" });
});

test("macro-enabled Office files are refused", () => {
  assert.deepEqual(v("application/vnd.openxmlformats-officedocument.presentationml.presentation", PPTM), { ok: false, reason: "macro_content" });
});

test("size and type allow-list", () => {
  assert.deepEqual(v("application/pdf", PDF, 26 * MB), { ok: false, reason: "too_large" });
  assert.deepEqual(v("image/svg+xml", bytes("<svg/>")), { ok: false, reason: "type_not_allowed" });
  assert.deepEqual(v("application/zip", zip(["a.txt"])), { ok: false, reason: "type_not_allowed" });
});

test("detectMime ignores a plain zip and binary noise", () => {
  assert.equal(detectMime(zip(["a.txt"]), ["a.txt"]), null);
  assert.equal(detectMime(bytes([0, 1, 2, 3, 0, 0])), null);
});

test("safeDisplayFilename strips paths and control characters", () => {
  assert.equal(safeDisplayFilename("../../a\u0000b.pdf"), "a b.pdf");
  assert.equal(safeDisplayFilename("C:\\Users\\me\\Notes   week 3.pdf"), "Notes week 3.pdf");
  const long = safeDisplayFilename(`${"x".repeat(300)}.pptx`);
  assert.equal(long.length, 120);
  assert.ok(long.endsWith(".pptx"));
  assert.equal(safeDisplayFilename(""), "file");
});
