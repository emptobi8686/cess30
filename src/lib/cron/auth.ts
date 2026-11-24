import { timingSafeEqual } from "node:crypto";

/** Scheduler calls must carry exactly `Authorization: Bearer <CRON_SECRET>` (constant-time compare). */
export function isAuthorizedCron(authorization: string | null, secret: string | undefined = process.env.CRON_SECRET): boolean {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
