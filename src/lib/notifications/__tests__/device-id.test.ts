import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseDeviceId } from "@/lib/notifications/device-id";

describe("parseDeviceId (BP-047)", () => {
  test("accepts UUIDs only", () => {
    assert.equal(parseDeviceId("abc"), null);
    assert.equal(parseDeviceId("1; drop table"), null);
    assert.equal(parseDeviceId("0b9f6e1c-6b8a-4c55-9d3f-1d2b6f4a9e10"), "0b9f6e1c-6b8a-4c55-9d3f-1d2b6f4a9e10");
  });
});
