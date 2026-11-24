import { z } from "zod";
import { LEVEL_CODES } from "@/features/academic/validation";

export const RESOURCE_TYPES = [
  "lecture_slides", "course_notes", "pdf_document", "presentation", "tutorial_sheet",
  "lab_manual", "reading_material", "past_question", "other",
] as const;

export const COPYRIGHT_BASES = [
  "own_work", "lecturer_permission", "department_owned", "open_licence", "public_domain", "approved_past_question",
] as const;

export const RESOURCE_TYPE_LABELS: Record<(typeof RESOURCE_TYPES)[number], string> = {
  lecture_slides: "Lecture slides",
  course_notes: "Course notes",
  pdf_document: "PDF document",
  presentation: "Presentation",
  tutorial_sheet: "Tutorial sheet",
  lab_manual: "Lab manual",
  reading_material: "Reading material",
  past_question: "Past question",
  other: "Other",
};

export const COPYRIGHT_LABELS: Record<(typeof COPYRIGHT_BASES)[number], string> = {
  own_work: "My own work",
  lecturer_permission: "Shared with the lecturer's permission",
  department_owned: "Owned by the department",
  open_licence: "Openly licensed (e.g. Creative Commons)",
  public_domain: "Public domain",
  approved_past_question: "Past question approved by the department",
};

export function normaliseTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null))
  .refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), "Choose a valid course.");

/** Form schema for library resource metadata (audiences are parsed separately with the E4 audience schema). */
export const libraryResourceSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be 3–200 characters.").max(200, "Title must be 3–200 characters."),
    description: z.string().max(2000, "Description cannot exceed 2000 characters.").optional()
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    resource_type: z.enum(RESOURCE_TYPES, { message: "Choose a resource type." }),
    copyright_basis: z.enum(COPYRIGHT_BASES, { message: "Choose the copyright basis." }),
    licence_note: z.string().max(500, "Licence note cannot exceed 500 characters.").optional()
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    tags: z.string().optional().transform((v) => normaliseTags((v ?? "").split(",")))
      .pipe(z.array(z.string().min(1).max(30, "Each tag must be at most 30 characters.")).max(10, "Use at most 10 tags.")),
    course_id: optionalUuid,
    level_code: z.string().optional().transform((v) => (v && v.trim() ? v.trim() : null))
      .refine((v) => v === null || (LEVEL_CODES as readonly string[]).includes(v), "Choose a valid level."),
    attestation: z.union([z.literal("on"), z.literal("true")], {
      message: "Confirm you have the right to share this file with students.",
    }),
  })
  .superRefine((value, ctx) => {
    if (value.resource_type === "past_question" && value.copyright_basis !== "approved_past_question") {
      ctx.addIssue({ code: "custom", path: ["copyright_basis"], message: "Past questions must be approved by the department before upload." });
    }
  });

export type LibraryResourceInput = z.infer<typeof libraryResourceSchema>;
