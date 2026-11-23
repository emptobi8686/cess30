import { afterEach, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolveAccess } from "@/lib/auth/access";
import { ACCESS_DENIED_MESSAGE, setAccessResolverForTests } from "@/lib/auth/guards";

before(() => {
  (process.env as Record<string, string>).NODE_ENV = "test";
});

afterEach(() => setAccessResolverForTests(null));

const asStatus = (status: string) => async () =>
  resolveAccess("u1", [], { verification_status: status });

describe("study planner actions enforce verification (BP-005)", () => {
  test("pending student cannot create a study session", async () => {
    setAccessResolverForTests(asStatus("pending"));
    const { createStudySession } = await import("@/features/study-planner/actions");
    assert.deepEqual(await createStudySession(new FormData()), {
      ok: false,
      error: ACCESS_DENIED_MESSAGE,
    });
  });

  test("suspended student cannot toggle completion", async () => {
    setAccessResolverForTests(asStatus("suspended"));
    const { toggleStudySessionCompleted } = await import("@/features/study-planner/actions");
    assert.deepEqual(await toggleStudySessionCompleted("x", true), {
      ok: false,
      error: ACCESS_DENIED_MESSAGE,
    });
  });

  test("unauthenticated caller cannot delete", async () => {
    setAccessResolverForTests(async () => null);
    const { deleteStudySession } = await import("@/features/study-planner/actions");
    assert.deepEqual(await deleteStudySession("x", false), {
      ok: false,
      error: ACCESS_DENIED_MESSAGE,
    });
  });
});

describe("quest submission enforces verification (BP-005)", () => {
  test("pending student cannot submit quest evidence", async () => {
    setAccessResolverForTests(asStatus("pending"));
    const { submitQuestAction } = await import("@/features/quests/actions");
    assert.deepEqual(await submitQuestAction(new FormData()), {
      ok: false,
      error: ACCESS_DENIED_MESSAGE,
    });
  });
});
