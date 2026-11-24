import { LEVEL_CODES } from "@/features/academic/validation";
import { z } from "zod";
import { lagosDateTimeLocalToUtcIso } from "@/lib/dates";

export type CreateQuestInput = {
  title: string;
  description: string;
  xp_reward: number;
  due_date: string | null;
  is_active: boolean;
};

export type SubmitQuestInput = {
  quest_id: string;
  evidence_url: string;
  notes: string | null;
};

export function validateCreateQuestInput(input: CreateQuestInput): string[] {
  const errors: string[] = [];

  const title = (input.title ?? "").trim();
  if (title.length < 3 || title.length > 160) {
    errors.push("Title must be between 3 and 160 characters.");
  }

  const description = (input.description ?? "").trim();
  if (description.length < 10 || description.length > 1000) {
    errors.push("Description must be between 10 and 1000 characters.");
  }

  const xpReward = Number(input.xp_reward);
  if (!Number.isInteger(xpReward) || xpReward < 1 || xpReward > 10000) {
    errors.push("XP reward must be an integer between 1 and 10000.");
  }

  if (input.due_date !== null && input.due_date !== undefined && input.due_date !== "") {
    const due = new Date(input.due_date);
    if (Number.isNaN(due.getTime())) {
      errors.push("Due date must be a valid date.");
    }
  }

  return errors;
}

export function validateSubmitQuestInput(input: SubmitQuestInput): string[] {
  const errors: string[] = [];

  if (!input.quest_id || !/^[0-9a-fA-F-]{36}$/.test(input.quest_id)) {
    errors.push("A valid quest is required.");
  }

  const evidenceUrl = (input.evidence_url ?? "").trim();
  if (evidenceUrl.length < 1 || evidenceUrl.length > 500) {
    errors.push("Evidence URL must be between 1 and 500 characters.");
  }

  if (input.notes !== null && input.notes !== undefined && input.notes.trim().length > 1000) {
    errors.push("Notes must not exceed 1000 characters.");
  }

  return errors;
}

/** Form schema for creating and editing quests (admin). Values arrive as FormData strings. */
export const questUpsertSchema = z.object({
  title: z.string().trim().min(3, "Title must be between 3 and 160 characters.").max(160, "Title must be between 3 and 160 characters."),
  description: z
    .string()
    .trim()
    .min(10, "Description must be between 10 and 1000 characters.")
    .max(1000, "Description must be between 10 and 1000 characters."),
  xp_reward: z.coerce
    .number({ message: "XP reward must be a whole number between 1 and 10000." })
    .int("XP reward must be a whole number between 1 and 10000.")
    .min(1, "XP reward must be a whole number between 1 and 10000.")
    .max(10000, "XP reward must be a whole number between 1 and 10000."),
  due_date: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value || !value.trim()) return null;
      try {
        return lagosDateTimeLocalToUtcIso(value);
      } catch {
        ctx.addIssue({ code: "custom", message: "Due date must be a valid date and time." });
        return z.NEVER;
      }
    }),
  is_active: z
    .union([z.literal("on"), z.literal("true"), z.literal("")])
    .optional()
    .transform((value) => value === "on" || value === "true"),
  /** Audience: a level (course representatives may only use their own) or "" for department-wide. */
  level_code: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      if (!(LEVEL_CODES as readonly string[]).includes(value)) {
        ctx.addIssue({ code: "custom", message: "Choose a valid level." });
        return z.NEVER;
      }
      return value;
    }),
});

export type QuestUpsertInput = z.output<typeof questUpsertSchema>;
