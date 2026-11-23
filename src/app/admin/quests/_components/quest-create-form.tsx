"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createQuestAction } from "@/features/quests/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";
import { FormStatus } from "./form-status";

export function QuestCreateForm() {
  const [state, action, pending] = useActionState(createQuestAction, IDLE_ACTION_STATE);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="new-quest-title">Title</Label>
        <Input id="new-quest-title" name="title" minLength={3} maxLength={160} placeholder="e.g. Submit lecture notes" required />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="new-quest-description">Description</Label>
        <Textarea id="new-quest-description" name="description" minLength={10} maxLength={1000} placeholder="Describe what the student must do…" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-quest-xp">XP reward</Label>
        <Input id="new-quest-xp" type="number" name="xp_reward" min={1} max={10000} step={1} defaultValue={50} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-quest-due">Due date (Lagos time, optional)</Label>
        <Input id="new-quest-due" type="datetime-local" name="due_date" />
      </div>
      <div className="flex items-center gap-2">
        <input id="new-quest-active" type="checkbox" name="is_active" defaultChecked />
        <Label htmlFor="new-quest-active">Active (visible to students)</Label>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create quest"}
        </Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
