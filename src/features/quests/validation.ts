export type CreateQuestInput = {
  title: string;
  description: string;
  xp_reward: number;
  due_date: string | null;
  is_active: boolean;
};

export type SubmitQuestInput = {
  quest_id: string;
  evidence_url: string;
  notes: string | null;
};

export function validateCreateQuestInput(input: CreateQuestInput): string[] {
  const errors: string[] = [];

  const title = (input.title ?? "").trim();
  if (title.length < 3 || title.length > 160) {
    errors.push("Title must be between 3 and 160 characters.");
  }

  const description = (input.description ?? "").trim();
  if (description.length < 10 || description.length > 1000) {
    errors.push("Description must be between 10 and 1000 characters.");
  }

  const xpReward = Number(input.xp_reward);
  if (!Number.isInteger(xpReward) || xpReward < 1 || xpReward > 10000) {
    errors.push("XP reward must be an integer between 1 and 10000.");
  }

  if (input.due_date !== null && input.due_date !== undefined && input.due_date !== "") {
    const due = new Date(input.due_date);
    if (Number.isNaN(due.getTime())) {
      errors.push("Due date must be a valid date.");
    }
  }

  return errors;
}

export function validateSubmitQuestInput(input: SubmitQuestInput): string[] {
  const errors: string[] = [];

  if (!input.quest_id || !/^[0-9a-fA-F-]{36}$/.test(input.quest_id)) {
    errors.push("A valid quest is required.");
  }

  const evidenceUrl = (input.evidence_url ?? "").trim();
  if (evidenceUrl.length < 1 || evidenceUrl.length > 500) {
    errors.push("Evidence URL must be between 1 and 500 characters.");
  }

  if (input.notes !== null && input.notes !== undefined && input.notes.trim().length > 1000) {
    errors.push("Notes must not exceed 1000 characters.");
  }

  return errors;
}
