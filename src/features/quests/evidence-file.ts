/**
 * Quest evidence uploads (photos and PDFs). Pure helpers shared by the browser dialog
 * and the server action: the browser checks type and size before uploading, the server
 * re-checks the stored bytes before accepting the submission.
 */

export const EVIDENCE_BUCKET = "quest-evidence";
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;

export type EvidenceMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

const EXT: Record<EvidenceMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const ALIASES: Record<string, EvidenceMime> = { "image/jpg": "image/jpeg", "image/pjpeg": "image/jpeg" };

/** File input `accept` value. */
export const EVIDENCE_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

const PATH = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$/;

function normalise(type: string): EvidenceMime | null {
  const base = type.split(";")[0].trim().toLowerCase();
  const mime = ALIASES[base] ?? base;
  return mime in EXT ? (mime as EvidenceMime) : null;
}

export type EvidenceCheck =
  | { ok: true; mime: EvidenceMime; ext: string }
  | { ok: false; error: string };

export function checkEvidenceUpload(file: { type: string; size: number }): EvidenceCheck {
  const mime = normalise(file.type);
  if (!mime) return { ok: false, error: "Upload a photo (JPG, PNG, WebP) or a PDF." };
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, error: "That file is empty." };
  if (file.size > EVIDENCE_MAX_BYTES) return { ok: false, error: "The file is larger than 10 MB." };
  return { ok: true, mime, ext: EXT[mime] };
}

function startsWith(head: Uint8Array, sig: number[], offset = 0): boolean {
  return sig.every((b, i) => head[offset + i] === b);
}

/** The real type from the first bytes, or null when it is not an allowed photo or PDF. */
export function sniffEvidence(head: Uint8Array): EvidenceMime | null {
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export function extForMime(mime: EvidenceMime): string {
  return EXT[mime];
}

export function planEvidencePath(studentId: string, ext: string): string {
  return `${studentId}/${crypto.randomUUID()}.${ext}`;
}

export function isEvidencePath(path: string): boolean {
  return PATH.test(path);
}

export function evidencePathOwner(path: string): string | null {
  return PATH.exec(path)?.[1] ?? null;
}
