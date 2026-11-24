import { safeDisplayFilename } from "./file-validation";

export type FileMode = "download" | "preview";

export function parseFileMode(value: string | null): FileMode {
  return value === "preview" ? "preview" : "download";
}

/** Options for Supabase createSignedUrl: previews render inline; downloads save under a safe name. */
export function buildContentDisposition(filename: string, mode: FileMode): { download: string | false } {
  return mode === "preview" ? { download: false } : { download: safeDisplayFilename(filename) };
}

/** Signed URL lifetimes in seconds (never logged or stored). */
export const SIGNED_URL_TTL: Record<FileMode, number> = { download: 120, preview: 300 };
