import type { LibraryValidation } from "./file-validation";

/** Server-generated object path: resources/{resource}/{file}.{ext}. Never user-controlled. */
export function planObjectPath(resourceId: string, fileId: string, ext: string): string {
  return `resources/${resourceId}/${fileId}.${ext}`;
}

export type FinalizeDecision = { action: "accept" } | { action: "reject"; deleteObject: true; message: string };

const REJECT_MESSAGES: Record<Exclude<LibraryValidation, { ok: true }>["reason"], string> = {
  too_large: "The file is larger than 25 MB.",
  type_not_allowed: "That file type is not allowed. Use PDF, PowerPoint, Word, PNG, JPEG or plain text.",
  content_mismatch: "The file content does not match its type.",
  macro_content: "Macro-enabled Office files are not allowed. Save it as a normal .pptx or .docx.",
};

/** What finalise does with an uploaded object once its bytes have been validated. */
export function finalizeDecision(result: LibraryValidation): FinalizeDecision {
  if (result.ok) return { action: "accept" };
  return { action: "reject", deleteObject: true, message: REJECT_MESSAGES[result.reason] };
}
