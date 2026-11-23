import { addDays, getDayOfWeek, parseDateString } from "@/lib/dates";

export type PlannerView = "daily" | "weekly" | "monthly" | "status";
export type DateRange = { start: string; end: string };

const pad = (value: number) => String(value).padStart(2, "0");

function monthRange(anchor: string): DateRange {
  const parts = parseDateString(anchor);
  if (!parts) throw new Error(`Invalid date: ${anchor}`);
  const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  const prefix = `${parts.year}-${pad(parts.month)}`;
  return { start: `${prefix}-01`, end: `${prefix}-${pad(lastDay)}` };
}

/** Calendar dates (YYYY-MM-DD, Africa/Lagos semantics) each planner view displays. */
export function rangeForView(view: PlannerView, anchor: string): DateRange {
  switch (view) {
    case "daily":
      return { start: anchor, end: anchor };
    case "weekly": {
      const offset = (getDayOfWeek(anchor) + 6) % 7; // Monday = 0
      const start = addDays(anchor, -offset);
      return { start, end: addDays(start, 6) };
    }
    case "monthly":
      return monthRange(anchor);
    case "status":
      return { start: addDays(anchor, -60), end: addDays(anchor, 120) };
  }
}

/** The window the page loads: covers every view around the anchor (BP-038). */
export function loadedRangeFor(anchor: string): DateRange {
  const month = rangeForView("monthly", anchor);
  const status = rangeForView("status", anchor);
  return {
    start: month.start < status.start ? month.start : status.start,
    end: month.end > status.end ? month.end : status.end,
  };
}

export function isWithinRange(date: string, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

export function parsePlannerView(value: string | string[] | undefined): PlannerView {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "weekly" || raw === "monthly" || raw === "status" ? raw : "daily";
}
