/**
 * Returns a normalised https URL suitable for an external <a href>, or null.
 * Rejects every non-https scheme (javascript:, data:, http:), relative paths,
 * and URLs carrying credentials.
 */
export function toSafeExternalHref(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
    return null;
  }

  return url.href;
}
