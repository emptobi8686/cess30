import type { NextConfig } from "next";
import { supabaseImagePattern } from "./src/features/profile/avatar";

const avatarPattern = supabaseImagePattern(process.env.NEXT_PUBLIC_SUPABASE_URL);

const nextConfig: NextConfig = {
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
