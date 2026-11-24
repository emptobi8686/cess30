const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates the [id] segment of /api/push/subscriptions/[id] (BP-047). */
export function parseDeviceId(value: string): string | null {
  return UUID.test(value) ? value.toLowerCase() : null;
}
