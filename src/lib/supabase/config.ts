import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export function validateSupabaseEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => issue.path.join(".") || issue.message);
    throw new Error(`Invalid Supabase environment configuration: ${issues.join(", ")}`);
  }

  return result.data;
}
