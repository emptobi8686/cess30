import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  validateCreateQuestInput,
  validateSubmitQuestInput,
} from "@/features/quests/validation";

describe("quest creation validation", () => {
  test("accepts a valid quest input", () => {
    const errors = validateCreateQuestInput({
      title: "Submit lecture notes",
      description: "Upload your cleaned lecture notes for review by the course representative.",
      xp_reward: 50,
      due_date: null,
      is_active: true,
    });
    assert.deepEqual(errors, []);
  });

  test("rejects a title that is too short", () => {
    const errors = validateCreateQuestInput({
      title: "ab",
      description: "A valid description with enough characters here.",
      xp_reward: 50,
      due_date: null,
      is_active: true,
    });
    assert.ok(errors.some((e) => e.includes("Title")));
  });

  test("rejects a title that is too long", () => {
    const errors = validateCreateQuestInput({
      title: "a".repeat(161),
      description: "A valid description with enough characters here.",
      xp_reward: 50,
      due_date: null,
      is_active: true,
    });
    assert.ok(errors.some((e) => e.includes("Title")));
  });

  test("rejects a description that is too short", () => {
    const errors = validateCreateQuestInput({
      title: "Valid title",
      description: "too short",
      xp_reward: 50,
      due_date: null,
      is_active: true,
    });
    assert.ok(errors.some((e) => e.includes("Description")));
  });

  test("rejects an invalid XP reward", () => {
    const errors = validateCreateQuestInput({
      title: "Valid title",
      description: "A valid description with enough characters here.",
      xp_reward: 0,
      due_date: null,
      is_active: true,
    });
    assert.ok(errors.some((e) => e.includes("XP reward")));

    const errors2 = validateCreateQuestInput({
      title: "Valid title",
      description: "A valid description with enough characters here.",
      xp_reward: 10001,
      due_date: null,
      is_active: true,
    });
    assert.ok(errors2.some((e) => e.includes("XP reward")));
  });

  test("rejects an invalid due date", () => {
    const errors = validateCreateQuestInput({
      title: "Valid title",
      description: "A valid description with enough characters here.",
      xp_reward: 50,
      due_date: "not-a-date",
      is_active: true,
    });
    assert.ok(errors.some((e) => e.includes("Due date")));
  });
});

describe("quest submission validation", () => {
  test("accepts a valid submission input", () => {
    const errors = validateSubmitQuestInput({
      quest_id: "11111111-1111-4111-8111-111111111111",
      evidence_url: "https://example.com/evidence.pdf",
      notes: "Some optional notes.",
    });
    assert.deepEqual(errors, []);
  });

  test("rejects an invalid quest id", () => {
    const errors = validateSubmitQuestInput({
      quest_id: "not-a-uuid",
      evidence_url: "https://example.com/evidence.pdf",
      notes: null,
    });
    assert.ok(errors.some((e) => e.includes("quest")));
  });

  test("rejects a submission with neither a link nor a file", () => {
    const errors = validateSubmitQuestInput({
      quest_id: "11111111-1111-4111-8111-111111111111",
      evidence_url: "",
      evidence_path: null,
      notes: null,
    });
    assert.ok(errors.some((e) => e.includes("link or upload a file")));
  });

  test("accepts an uploaded file without a link", () => {
    const errors = validateSubmitQuestInput({
      quest_id: "11111111-1111-4111-8111-111111111111",
      evidence_url: "",
      evidence_path: "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg",
      notes: null,
    });
    assert.deepEqual(errors, []);
  });

  test("rejects notes that are too long", () => {
    const errors = validateSubmitQuestInput({
      quest_id: "11111111-1111-4111-8111-111111111111",
      evidence_url: "https://example.com/evidence.pdf",
      notes: "a".repeat(1001),
    });
    assert.ok(errors.some((e) => e.includes("Notes")));
  });
});

import { questUpsertSchema } from "@/features/quests/validation";

describe("questUpsertSchema", () => {
  test("missing is_active means inactive (unchecked checkbox)", () => {
    const r = questUpsertSchema.safeParse({
      title: "Lab 1",
      description: "Submit your lab write-up",
      xp_reward: "50",
    });
    assert.equal(r.success, true);
    assert.equal(r.success && r.data.is_active, false);
  });
  test("checkbox 'on' means active and XP is coerced", () => {
    const r = questUpsertSchema.safeParse({
      title: "Lab 1",
      description: "Submit your lab write-up",
      xp_reward: "50",
      is_active: "on",
    });
    assert.equal(r.success && r.data.is_active, true);
    assert.equal(r.success && r.data.xp_reward, 50);
  });
  test("due date is converted from Lagos time", () => {
    const r = questUpsertSchema.safeParse({
      title: "Lab 1",
      description: "Submit your lab write-up",
      xp_reward: "50",
      due_date: "2026-12-01T17:00",
    });
    assert.equal(r.success && r.data.due_date, "2026-12-01T16:00:00.000Z");
  });
  test("empty due date means no deadline", () => {
    const r = questUpsertSchema.safeParse({
      title: "Lab 1",
      description: "Submit your lab write-up",
      xp_reward: "50",
      due_date: "",
    });
    assert.equal(r.success && r.data.due_date, null);
  });
  test("rejects out-of-range XP and short text", () => {
    assert.equal(questUpsertSchema.safeParse({ title: "Lab", description: "Ten chars!", xp_reward: "0" }).success, false);
    assert.equal(questUpsertSchema.safeParse({ title: "Lab", description: "Ten chars!", xp_reward: "abc" }).success, false);
    assert.equal(questUpsertSchema.safeParse({ title: "La", description: "Ten chars!", xp_reward: "5" }).success, false);
  });
});

describe("questUpsertSchema level audience (decision 0004)", () => {
  const base = { title: "Lab 1", description: "Submit your lab write-up", xp_reward: "50" };
  test("empty level means department-wide (null)", () => {
    const r = questUpsertSchema.safeParse({ ...base, level_code: "" });
    assert.equal(r.success && r.data.level_code, null);
  });
  test("a known level is kept", () => {
    const r = questUpsertSchema.safeParse({ ...base, level_code: "300" });
    assert.equal(r.success && r.data.level_code, "300");
  });
  test("an unknown level is rejected", () => {
    assert.equal(questUpsertSchema.safeParse({ ...base, level_code: "700" }).success, false);
  });
});
