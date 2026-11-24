/**
 * Library upload validation (P8). Runs on the server against the stored bytes, so a
 * file is accepted only when its content matches an allowed type, whatever its name or
 * declared MIME type says. No dependencies: signatures are checked by hand and OOXML
 * containers are inspected through the zip central directory.
 */

export const LIBRARY_MAX_BYTES = 25 * 1024 * 1024;

export type LibraryMime =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  | "application/vnd.ms-powerpoint"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/msword"
  | "image/png"
  | "image/jpeg"
  | "text/plain";

export const LIBRARY_EXT: Record<LibraryMime, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "image/png": "png",
  "image/jpeg": "jpg",
  "text/plain": "txt",
};

const ALLOWED = Object.keys(LIBRARY_EXT) as LibraryMime[];
const ALIASES: Record<string, LibraryMime> = { "image/jpg": "image/jpeg", "image/pjpeg": "image/jpeg" };

export function normaliseDeclaredMime(declared: string): LibraryMime | null {
  const base = declared.split(";")[0].trim().toLowerCase();
  const mime = (ALIASES[base] ?? base) as LibraryMime;
  return ALLOWED.includes(mime) ? mime : null;
}

const MACRO_MARKER = "macro";

function startsWith(head: Uint8Array, sig: number[]): boolean {
  return sig.every((b, i) => head[i] === b);
}

function looksLikeHtmlOrScript(text: string): boolean {
  return /<\s*(!doctype\s+html|html|script|iframe|svg|object|embed)\b/i.test(text.slice(0, 4096));
}

/**
 * Detects the real type from the first bytes. OLE (legacy .ppt/.doc) cannot be told
 * apart by signature alone, so the declared type picks between those two only.
 * Returns "macro" (internal) for OOXML containers carrying VBA projects.
 */
export function detectMime(
  head: Uint8Array,
  zipEntryNames?: string[],
  declared?: LibraryMime | null
): LibraryMime | typeof MACRO_MARKER | null {
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return declared === "application/vnd.ms-powerpoint" || declared === "application/msword" ? declared : null;
  }
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) {
    const names = zipEntryNames ?? [];
    if (!names.includes("[Content_Types].xml")) return null;
    if (names.some((n) => /(^|\/)vbaProject\.bin$/i.test(n))) return MACRO_MARKER;
    if (names.some((n) => n.startsWith("ppt/"))) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (names.some((n) => n.startsWith("word/"))) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    return null;
  }
  const sample = head.subarray(0, 4096);
  if (sample.includes(0)) return null;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(sample);
    if (looksLikeHtmlOrScript(text)) return null;
    return "text/plain";
  } catch {
    return null;
  }
}

export type LibraryValidation =
  | { ok: true; mime: LibraryMime; ext: string }
  | { ok: false; reason: "too_large" | "type_not_allowed" | "content_mismatch" | "macro_content" };

export function validateLibraryUpload(input: {
  declaredMime: string;
  sizeBytes: number;
  head: Uint8Array;
  zipEntryNames?: string[];
}): LibraryValidation {
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > LIBRARY_MAX_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  const declared = normaliseDeclaredMime(input.declaredMime);
  if (!declared) return { ok: false, reason: "type_not_allowed" };
  const detected = detectMime(input.head, input.zipEntryNames, declared);
  if (detected === MACRO_MARKER) return { ok: false, reason: "macro_content" };
  if (detected !== declared) return { ok: false, reason: "content_mismatch" };
  return { ok: true, mime: declared, ext: LIBRARY_EXT[declared] };
}

/**
 * Zip central-directory parse (no decompression needed): find the End Of Central
 * Directory record (signature 0x06054b50) scanning back from the end over at most the
 * last 64 KB + 22 bytes (the comment can be up to 65535 bytes), read the directory
 * size/offset, then walk the 0x02014b50 file headers collecting their names.
 * Returns null when the bytes are not a readable zip.
 */
export function readZipEntryNames(buf: Uint8Array): string[] | null {
  if (!startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const minEocd = Math.max(0, buf.length - (0xffff + 22));
  let eocd = -1;
  for (let i = buf.length - 22; i >= minEocd; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const entries = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  let p = view.getUint32(eocd + 16, true);
  if (p + cdSize > buf.length) return null;
  const decoder = new TextDecoder();
  const names: string[] = [];
  for (let n = 0; n < entries && n < 5000; n += 1) {
    if (p + 46 > buf.length || view.getUint32(p, true) !== 0x02014b50) return null;
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    if (p + 46 + nameLen > buf.length) return null;
    names.push(decoder.decode(buf.subarray(p + 46, p + 46 + nameLen)));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

/** Display-only filename: no paths or control characters, collapsed spaces, max 120 chars keeping the extension. */
export function safeDisplayFilename(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (!base) return "file";
  if (base.length <= 120) return base;
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 && base.length - dot <= 10 ? base.slice(dot) : "";
  return base.slice(0, 120 - ext.length) + ext;
}
