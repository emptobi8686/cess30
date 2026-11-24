import { z } from "zod";
import { LEVEL_CODES } from "@/features/academic/validation";
import { parseVideoUrl } from "./video-url";

/** Mirrors the seeded tutorial_provider_domains (decision 0004 item 7, provisional). The action re-checks against the database list. */
export const DEFAULT_TUTORIAL_DOMAINS = ["youtube.com", "youtu.be", "vimeo.com", "ocw.mit.edu", "khanacademy.org", "nptel.ac.in"];

const blankToNull = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

export const tutorialSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be 3–160 characters.").max(160, "Title must be 3–160 characters."),
    description: z.string().max(2000, "Description cannot exceed 2000 characters.").optional().transform(blankToNull),
    topic: z.string().trim().min(2, "Topic must be 2–80 characters.").max(80, "Topic must be 2–80 characters."),
    learning_objectives: z
      .string()
      .transform((v) => v.split("\n").map((s) => s.trim()).filter(Boolean))
      .pipe(z.array(z.string().min(5, "Each learning objective needs 5–200 characters.").max(200, "Each learning objective needs 5–200 characters."))
        .min(1, "Add at least one learning objective.").max(8, "Use at most 8 learning objectives.")),
    video_url: z.string().trim().min(1, "Paste the video link."),
    duration_minutes: z.string().optional().transform((v, ctx) => {
      if (!v || !v.trim()) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0 || n > 600) {
        ctx.addIssue({ code: "custom", message: "Duration must be between 1 and 600 minutes." });
        return z.NEVER;
      }
      return n;
    }),
    course_id: z.string().optional().transform(blankToNull),
    level_code: z.string().optional().transform(blankToNull)
      .refine((v) => v === null || (LEVEL_CODES as readonly string[]).includes(v), "Choose a valid level."),
  })
  .superRefine((value, ctx) => {
    if (!parseVideoUrl(value.video_url, DEFAULT_TUTORIAL_DOMAINS)) {
      ctx.addIssue({ code: "custom", path: ["video_url"], message: "Use a YouTube, Vimeo or approved site link (https)." });
    }
  })
  .transform(({ duration_minutes, ...rest }) => ({
    ...rest,
    duration_seconds: duration_minutes === null ? null : Math.round(duration_minutes * 60),
    video: parseVideoUrl(rest.video_url, DEFAULT_TUTORIAL_DOMAINS)!,
  }));

export type TutorialInput = z.infer<typeof tutorialSchema>;
