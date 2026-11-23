"use client";

import { AudiencePicker } from "@/components/shared/audience-picker";
import { toAudienceInputs } from "@/features/audiences/schema";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateQuestAction } from "@/features/quests/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";
import { utcIsoToLagosDateTimeLocal } from "@/lib/dates";
import type { Quest } from "@/types";
import { FormStatus } from "./form-status";

export function QuestEditForm({ quest }: { quest: Quest }) {
  const [state, action, pending] = useActionState(updateQuestAction, IDLE_ACTION_STATE);
  const id = (field: string) => `quest-${quest.id}-${field}`;

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="questId" value={quest.id} />
      <div className="space-y-1.5">
        <Label htmlFor={id("title")}>Title</Label>
        <Input id={id("title")} name="title" defaultValue={quest.title} minLength={3} maxLength={160} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("xp")}>XP reward</Label>
        <Input id={id("xp")} type="number" name="xp_reward" defaultValue={quest.xp_reward} min={1} max={10000} step={1} required />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={id("description")}>Description</Label>
        <Textarea id={id("description")} name="description" defaultValue={quest.description} minLength={10} maxLength={1000} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("due")}>Due date (Lagos time)</Label>
        <Input id={id("due")} type="datetime-local" name="due_date" defaultValue={utcIsoToLagosDateTimeLocal(quest.due_date)} />
      </div>
      <div className="sm:col-span-2"><AudiencePicker name="audiences" id={id("audience")} defaultValue={toAudienceInputs(quest.quest_audiences)} /></div>
      <div className="flex items-center gap-2 self-end">
        <input id={id("active")} type="checkbox" name="is_active" defaultChecked={quest.is_active} />
        <Label htmlFor={id("active")}>Active</Label>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
