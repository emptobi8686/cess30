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

  test("rejects a missing evidence URL", () => {
    const errors = validateSubmitQuestInput({
      quest_id: "11111111-1111-4111-8111-111111111111",
      evidence_url: "",
      notes: null,
    });
    assert.ok(errors.some((e) => e.includes("Evidence URL")));
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
