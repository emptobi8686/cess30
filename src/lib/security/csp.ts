/**
 * Content-Security-Policy and hardening headers (audit finding BP-053).
 * Later modules (Library previews, Tutorials embeds) extend the allow-lists through
 * the extra* options; nothing here may be loosened to a wildcard.
 */

export type CspOptions = {
  supabaseUrl: string | undefined;
  development?: boolean;
  extraFrameSrc?: string[];
  extraScriptSrc?: string[];
  extraImgSrc?: string[];
};

function origins(supabaseUrl: string | undefined): { http: string | null; ws: string | null } {
  if (!supabaseUrl) return { http: null, ws: null };
  try {
    const url = new URL(supabaseUrl);
    return { http: url.origin, ws: `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}` };
  } catch {
    return { http: null, ws: null };
  }
}

export function buildCsp(options: CspOptions): string {
  const { http, ws } = origins(options.supabaseUrl);
  const supabase = http ? [http] : [];
  const dev = Boolean(options.development);

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Next.js injects inline bootstrap scripts; nonces can replace 'unsafe-inline' later.
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), ...(options.extraScriptSrc ?? [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...supabase, ...(options.extraImgSrc ?? [])],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...supabase, ...(ws ? [ws] : []), ...(dev ? ["ws:"] : [])],
    "frame-src": options.extraFrameSrc?.length ? options.extraFrameSrc : ["'none'"],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://accounts.google.com", ...supabase],
    "frame-ancestors": ["'none'"],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function securityHeaders(options: { supabaseUrl: string | undefined; production: boolean }) {
  const headers = [
    {
      key: "Content-Security-Policy",
      value: buildCsp({
        supabaseUrl: options.supabaseUrl,
        development: !options.production,
        // Library PDF previews: /api/library/{id}/file redirects to a signed Storage URL.
        extraFrameSrc: [
          "'self'",
          ...(origins(options.supabaseUrl).http ? [origins(options.supabaseUrl).http as string] : []),
          // Tutorials (P9): fixed embed templates only.
          "https://www.youtube-nocookie.com",
          "https://player.vimeo.com",
        ],
        extraImgSrc: ["https://i.ytimg.com"],
      }),
    },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];
  if (options.production) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  }
  return headers;
}
