"use client";

import { useActionState, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { startEvidenceUploadAction, submitQuestAction } from "@/features/quests/actions";
import { EVIDENCE_ACCEPT, EVIDENCE_BUCKET, checkEvidenceUpload } from "@/features/quests/evidence-file";
import { IDLE_ACTION_STATE, errorState, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/client";

/** Uploads the chosen file straight to private storage, then submits its path. */
async function uploadThenSubmit(previous: ActionState, formData: FormData): Promise<ActionState> {
  const file = formData.get("evidence_file");
  formData.delete("evidence_file");
  if (file instanceof File && file.size > 0) {
    const check = checkEvidenceUpload(file);
    if (!check.ok) return errorState(check.error);
    const started = await startEvidenceUploadAction({
      questId: String(formData.get("quest_id") ?? ""),
      type: check.mime,
      size: file.size,
    });
    if (!started.ok) return errorState(started.error);
    const { error } = await createClient()
      .storage.from(EVIDENCE_BUCKET)
      .uploadToSignedUrl(started.data.path, started.data.token, file, { contentType: check.mime });
    if (error) return errorState("The file could not be uploaded. Check your connection and try again.");
    formData.set("evidence_path", started.data.path);
  }
  return submitQuestAction(previous, formData);
}

export function SubmitEvidenceDialog({
  questId,
  questTitle,
  disabled,
}: {
  questId: string;
  questTitle: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(uploadThenSubmit, IDLE_ACTION_STATE);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  if (state.status === "success") {
    return (
      <p role="status" className="text-xs text-primary">
        {state.message}
      </p>
    );
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setFileName(null);
      setFileError(null);
      return;
    }
    const check = checkEvidenceUpload(file);
    setFileError(check.ok ? null : check.error);
    setFileName(check.ok ? file.name : null);
    if (!check.ok) event.target.value = "";
  }

  function clearFile() {
    if (fileInput.current) fileInput.current.value = "";
    setFileName(null);
    setFileError(null);
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" disabled={disabled} className="w-full" />}>
        {disabled ? "Expired" : "Submit evidence"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit evidence for &quot;{questTitle}&quot;</DialogTitle>
          <DialogDescription>Upload a photo or PDF, add a link, or both.</DialogDescription>
        </DialogHeader>
        <form action={action} className="mt-4 space-y-4">
          <input type="hidden" name="quest_id" value={questId} />
          <div className="space-y-2">
            <Label htmlFor={`evidence-file-${questId}`}>Upload a file</Label>
            <label
              htmlFor={`evidence-file-${questId}`}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-sm hover:bg-muted/40"
            >
              <Paperclip className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="truncate">{fileName ?? "Choose a photo or PDF (max 10 MB)"}</span>
            </label>
            <input
              ref={fileInput}
              id={`evidence-file-${questId}`}
              name="evidence_file"
              type="file"
              accept={EVIDENCE_ACCEPT}
              onChange={onFileChange}
              className="sr-only"
              data-testid="evidence-file"
            />
            {fileName ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearFile}>
                <X className="mr-1 h-3.5 w-3.5" aria-hidden /> Remove file
              </Button>
            ) : null}
            {fileError ? <p role="status" className="text-xs text-destructive">{fileError}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`evidence-${questId}`}>Or paste a link</Label>
            <Input
              id={`evidence-${questId}`}
              name="evidence_url"
              type="url"
              inputMode="url"
              pattern="https://.*"
              maxLength={500}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`notes-${questId}`}>Notes (optional)</Label>
            <Textarea
              id={`notes-${questId}`}
              name="notes"
              rows={2}
              maxLength={1000}
              placeholder="Any additional context for reviewers…"
            />
          </div>
          {state.status === "error" ? (
            <p role="status" className="text-xs text-destructive">
              {state.message}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" size="sm" className="ml-auto" />}>
              Cancel
            </DialogClose>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? (fileName ? "Uploading…" : "Submitting…") : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
