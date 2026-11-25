"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { finalizeLibraryUploadAction, startLibraryUploadAction } from "@/features/library/upload-actions";
import { createClient } from "@/lib/supabase/client";

const ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg,.txt";

/** start (server reserves a version + signed URL) → upload straight to storage → finalise (server validates). */
export function UploadFile({ resourceId }: { resourceId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function upload() {
    const file = input.current?.files?.[0];
    setError(null);
    setDone(null);
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    startTransition(async () => {
      setStage("Preparing…");
      const started = await startLibraryUploadAction({
        resourceId,
        declaredMime: file.type || "application/octet-stream",
        sizeBytes: file.size,
        originalFilename: file.name,
      });
      if (!started.ok) {
        setStage(null);
        setError(started.error);
        return;
      }
      setStage("Uploading…");
      const { error: uploadError } = await createClient()
        .storage.from("library")
        .uploadToSignedUrl(started.data.path, started.data.token, file, { contentType: file.type });
      if (uploadError) {
        setStage(null);
        setError("The upload failed. Check your connection and try again.");
        return;
      }
      setStage("Checking the file…");
      const finished = await finalizeLibraryUploadAction(started.data.fileId);
      setStage(null);
      if (!finished.ok) {
        setError(finished.error);
        return;
      }
      setDone(`Version ${finished.data.version} uploaded.`);
      if (input.current) input.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Label className="leading-snug" htmlFor={`file-${resourceId}`}>File (PDF, PowerPoint, Word, PNG, JPEG or text; up to 25 MB)</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input id={`file-${resourceId}`} ref={input} type="file" accept={ACCEPT} disabled={pending} className="min-w-0 max-w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium" />
        <Button type="button" onClick={upload} disabled={pending}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {pending ? stage ?? "Working…" : "Upload"}
        </Button>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {done ? <p role="status" className="text-sm text-primary">{done}</p> : null}
    </div>
  );
}
