import { addDays, getDayOfWeek, isValidDateString } from "@/lib/dates";

export const MAX_SERIES_DATES = 120;

/**
 * Lecture dates for a weekly series within an offering's semester (Lagos calendar dates).
 * weekdays use getDayOfWeek() numbering (0 = Sunday … 6 = Saturday).
 */
export function expandWeeklySeries(input: {
  offeringSemester: { starts_on: string; ends_on: string };
  weekdays: number[];
  startTime: string;
  endTime: string;
  skipDates: string[];
}): string[] {
  const { starts_on, ends_on } = input.offeringSemester;
  if (!isValidDateString(starts_on) || !isValidDateString(ends_on) || starts_on > ends_on) return [];
  const days = new Set(input.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
  if (days.size === 0) return [];
  const skip = new Set(input.skipDates);
  const dates: string[] = [];
  for (let date = starts_on; date <= ends_on && dates.length < MAX_SERIES_DATES; date = addDays(date, 1)) {
    if (days.has(getDayOfWeek(date)) && !skip.has(date)) dates.push(date);
  }
  return dates;
}
