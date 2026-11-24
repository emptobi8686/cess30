/** Pure helpers for the profile-picture pipeline (audit finding BP-026). */

export const AVATAR_BUCKET = "profile-pictures";
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const EXTENSIONS: Record<string, "jpg" | "png" | "webp" | "gif"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function extensionForMime(mime: string): "jpg" | "png" | "webp" | "gif" | null {
  return EXTENSIONS[mime] ?? null;
}

export function validateAvatarFile(file: { type: string; size: number }): string | null {
  if (!extensionForMime(file.type)) return "Only JPEG, PNG, WebP and GIF images are allowed.";
  if (file.size > AVATAR_MAX_BYTES) return "Profile picture must be smaller than 5 MB.";
  return null;
}

/** `<userId>/<uuid>.<ext>`: the first folder must equal the owner (Storage RLS, migration 014). */
export function avatarObjectPath(userId: string, mime: string): string {
  const ext = extensionForMime(mime);
  if (!ext) throw new Error("Unsupported image type.");
  return `${userId}/${crypto.randomUUID()}.${ext}`;
}

/** Extracts the object path from a Supabase public URL for the given bucket, else null. */
export function objectPathFromPublicUrl(url: string, bucket: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = parsed.pathname.indexOf(marker);
  if (index === -1) return null;
  const path = decodeURIComponent(parsed.pathname.slice(index + marker.length));
  return path && !path.includes("..") ? path : null;
}

/** next.config images.remotePatterns entry for the project's public avatar objects. */
export function supabaseImagePattern(supabaseUrl: string | undefined) {
  if (!supabaseUrl) return null;
  try {
    const url = new URL(supabaseUrl);
    return {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      port: url.port,
      pathname: `/storage/v1/object/public/${AVATAR_BUCKET}/**`,
    };
  } catch {
    return null;
  }
}
