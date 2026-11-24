import type { NextConfig } from "next";
import { supabaseImagePattern } from "./src/features/profile/avatar";
import { securityHeaders } from "./src/lib/security/csp";

const avatarPattern = supabaseImagePattern(process.env.NEXT_PUBLIC_SUPABASE_URL);

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          production: process.env.NODE_ENV === "production",
        }),
      },
    ];
  },
  images: {
    // Profile pictures are served from the project's public Storage bucket only (BP-026).
    remotePatterns: avatarPattern ? [avatarPattern] : [],
  },
  experimental: {
    agentFeedback: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
