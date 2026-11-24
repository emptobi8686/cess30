const INTERNAL_ORIGIN = "https://blueprint.invalid";

/**
 * Returns a same-origin path (pathname + search + hash) for post-auth redirects,
 * or the fallback. The WHATWG URL parser strips tab/newline characters, so
 * "/\t/evil.example" would otherwise resolve to "//evil.example" (BP-020):
 * any control character or backslash is rejected outright, and the resolved
 * URL must stay on the internal origin.
 */
export function safeNextPath(value: string | null, fallback: string): string {
  if (!value || !value.startsWith("/")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, INTERNAL_ORIGIN);
  } catch {
    return fallback;
  }

  if (url.origin !== INTERNAL_ORIGIN) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
