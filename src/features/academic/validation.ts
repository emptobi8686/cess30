import { z } from "zod";
import { isValidDateString } from "@/lib/dates";

const calendarDate = z.string().refine(isValidDateString, "Enter a valid date (YYYY-MM-DD).");

export const sessionSchema = z
  .object({
    label: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/, "Use the format 2026/2027.")
      .refine((value) => {
        const [start, end] = value.split("/").map(Number);
        return end === start + 1;
      }, "The second year must follow the first (e.g. 2026/2027)."),
    starts_on: calendarDate,
    ends_on: calendarDate,
  })
  .refine((value) => value.starts_on < value.ends_on, {
    message: "The session must start before it ends.",
    path: ["ends_on"],
  });

export const semesterSchema = z
  .object({
    number: z.coerce.number().int().min(1, "Semester number must be 1, 2 or 3.").max(3, "Semester number must be 1, 2 or 3."),
    label: z.string().trim().min(3, "Label must be 3–40 characters.").max(40, "Label must be 3–40 characters."),
    starts_on: calendarDate,
    ends_on: calendarDate,
  })
  .refine((value) => value.starts_on < value.ends_on, {
    message: "The semester must start before it ends.",
    path: ["ends_on"],
  });

export const LEVEL_CODES = ["100", "200", "300", "400", "500"] as const;
