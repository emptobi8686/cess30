/**
 * Feature switches. Tutorials stay hidden until its database migration (040) is applied
 * in production; then set NEXT_PUBLIC_FEATURE_TUTORIALS=true in Vercel and redeploy.
 */
export function tutorialsEnabled(value: string | undefined = process.env.NEXT_PUBLIC_FEATURE_TUTORIALS): boolean {
  return value === "true";
}

export const FEATURES = {
  tutorials: tutorialsEnabled(),
} as const;
