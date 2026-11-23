import { z } from "zod";

export const COURSE_LEVELS = ["100", "200", "300", "400", "500"] as const;

export const courseSchema = z.object({
  course_code: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}\d{3}$/, "Course code must look like CEE301.")),
  course_title: z.string().trim().min(3, "Title must be 3–160 characters.").max(160, "Title must be 3–160 characters."),
  credit_units: z.coerce
    .number({ message: "Units must be a whole number from 1 to 6." })
    .int("Units must be a whole number from 1 to 6.")
    .min(1, "Units must be a whole number from 1 to 6.")
    .max(6, "Units must be a whole number from 1 to 6."),
  level: z.enum(COURSE_LEVELS, { message: "Choose a level from 100 to 500." }),
});

export type CourseInput = z.output<typeof courseSchema>;
