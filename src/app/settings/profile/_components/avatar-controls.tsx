"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteProfilePicture, setAvatarAction } from "@/app/actions/profile";
import { AVATAR_BUCKET, avatarObjectPath, validateAvatarFile } from "@/features/profile/avatar";
import { createClient } from "@/lib/supabase/client";

type Status = { kind: "idle" | "working" | "error" | "success"; message: string | null };

export function AvatarControls({
  userId,
  avatarUrl,
  initials,
}: {
  userId: string;
  avatarUrl: string | null;
  initials: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle", message: null });
  const busy = status.kind === "working";

  async function upload(file: File) {
    const invalid = validateAvatarFile(file);
    if (invalid) {
      setStatus({ kind: "error", message: invalid });
      return;
    }

    setStatus({ kind: "working", message: "Uploading…" });
    const path = avatarObjectPath(userId, file.type);
    // Direct browser upload: Storage RLS restricts writes to the user's own folder.
    const { error } = await createClient()
      .storage.from(AVATAR_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });

    if (error) {
      setStatus({ kind: "error", message: "The picture could not be uploaded. Please try again." });
      return;
    }

    const result = await setAvatarAction(path);
    if (result?.error) {
      setStatus({ kind: "error", message: result.error });
      return;
    }
    setStatus({ kind: "success", message: result?.success ?? "Profile picture updated." });
    router.refresh();
  }

  async function remove() {
    setStatus({ kind: "working", message: "Removing…" });
    const result = await deleteProfilePicture();
    if (result?.error) {
      setStatus({ kind: "error", message: result.error });
      return;
    }
    setStatus({ kind: "success", message: result?.success ?? "Profile picture removed." });
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
        {avatarUrl ? (
          <Image src={avatarUrl} alt="Profile picture" className="h-full w-full object-cover" width={128} height={128} priority />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-muted/50">
            <ImageIcon className="h-10 w-10 text-muted-foreground" aria-hidden />
            <span className="mt-1 text-xs font-medium text-muted-foreground">{initials}</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        id="profilePictureInput"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        aria-label="Choose a profile picture"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />

      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Upload className="h-3 w-3" aria-hidden />}
          {avatarUrl ? "Replace picture" : "Upload picture"}
        </Button>
        {avatarUrl ? (
          <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void remove()}>
            <Trash2 className="h-3 w-3" aria-hidden />
            Remove picture
          </Button>
        ) : null}
      </div>

      {status.message ? (
        <p
          role="status"
          className={status.kind === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
        >
          {status.message}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF, up to 5 MB.</p>
    </div>
  );
}
