import type { ReminderPreference } from "@/types";
import { addDays, getLagosNow, LAGOS_TZ } from "@/lib/dates";

export const NOTIFICATION_TIME_ZONE = LAGOS_TZ;

type LagosDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const lagosFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: NOTIFICATION_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getLagosParts(date: Date): LagosDateTime {
  const parts = lagosFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

export function getLagosDateAndTime(date: Date) {
  return getLagosNow(date);
}

export function addCalendarDays(date: string, days: number) {
  return addDays(date, days);
}

export function lagosLocalTimeToUtc(date: string, time: string) {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeParts = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!dateParts || !timeParts) {
    throw new Error("A valid ISO date and local time are required.");
  }

  const [, year, month, day] = dateParts;
  const [, hour, minute, second = "0"] = timeParts;
  const desiredUtcValue = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  const sample = new Date(desiredUtcValue);
  const localAtSample = getLagosParts(sample);
  const representedAsUtc = Date.UTC(
    localAtSample.year,
    localAtSample.month - 1,
    localAtSample.day,
    localAtSample.hour,
    localAtSample.minute,
    localAtSample.second
  );
  const timezoneOffset = representedAsUtc - desiredUtcValue;
  return new Date(desiredUtcValue - timezoneOffset);
}

export function getReminderMinutes(preference: ReminderPreference) {
  switch (preference) {
    case "15_min":
      return 15;
    case "30_min":
      return 30;
    case "1_hour":
      return 60;
    case "1_day":
      return 24 * 60;
    case "none":
      return null;
  }
}

export function isWithinQuietHours(
  date: Date,
  enabled: boolean,
  quietStart: string,
  quietEnd: string
) {
  if (!enabled) return false;

  const { time } = getLagosDateAndTime(date);
  const currentMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(quietStart);
  const endMinutes = timeToMinutes(quietEnd);

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function timeToMinutes(time: string) {
  const match = /^(\d{2}):(\d{2})/.exec(time);
  if (!match) throw new Error("Quiet hours must use a valid time value.");
  return Number(match[1]) * 60 + Number(match[2]);
}
