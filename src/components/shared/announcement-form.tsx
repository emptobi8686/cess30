"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createAnnouncement,
  updateAnnouncement,
} from "@/features/announcements/actions";
import type { Announcement, Course } from "@/types";

type Props = {
  courses: Course[];
  announcement?: Announcement | null;
  onSuccess?: () => void;
};

export function AnnouncementForm({ courses, announcement, onSuccess }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scope, setScope] = useState<string>(announcement?.scope ?? "all");
  const [courseId, setCourseId] = useState<string>(announcement?.course_id ?? "");
  const [notifyStudents, setNotifyStudents] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);
    formData.set("scope", scope);
    formData.set("course_id", scope === "course" ? courseId : "");

    startTransition(async () => {
      const result = announcement
        ? await updateAnnouncement(announcement.id, formData)
        : await createAnnouncement(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess(announcement ? "Announcement updated." : "Announcement created.");
      router.refresh();
      onSuccess?.();
    });
  }

  async function handlePublish(formData: FormData) {
    formData.set("scope", scope);
    formData.set("course_id", scope === "course" ? courseId : "");
    formData.set("publish", "true");
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await createAnnouncement(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Announcement published.");
      router.refresh();
      onSuccess?.();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
              maxLength={160}
          required
          placeholder="e.g. Mid-semester test date"
          defaultValue={announcement?.title ?? ""}
        />
      </div>

      {/* Content */}
      <div className="space-y-1.5">
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          name="content"
              maxLength={5000}
          required
          placeholder="Write the announcement message…"
          className="min-h-[120px]"
          defaultValue={announcement?.content ?? ""}
        />
      </div>

      {/* Scope */}
      <div className="space-y-1.5">
        <Label htmlFor="scope">Scope</Label>
        <Select value={scope} onValueChange={(v: string | null) => setScope(v ?? "all")}>
          <SelectTrigger className="w-full" id="scope">
            <SelectValue placeholder="Select scope…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All students</SelectItem>
            <SelectItem value="department">Department</SelectItem>
            <SelectItem value="level">Level (200)</SelectItem>
            <SelectItem value="course">Course-specific</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Course — only shown when scope = course */}
      {scope === "course" && (
        <div className="space-y-1.5">
          <Label htmlFor="course_id">Course</Label>
          <Select value={courseId} onValueChange={(v: string | null) => setCourseId(v ?? "")}>
            <SelectTrigger className="w-full" id="course_id">
              <SelectValue placeholder="Select a course…" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.course_code} — {c.course_title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Course notifications go to students whose profile department and level match the course.
          </p>
        </div>
      )}

      {!announcement && (
        <fieldset className="space-y-2 rounded-lg border border-border/70 p-3">
          <legend className="px-1 text-sm font-medium">Notification delivery</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="notify_students"
              value="true"
              checked={notifyStudents}
              onChange={(event) => setNotifyStudents(event.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>Create an in-app notification for eligible students</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              name="send_push"
              value="true"
              disabled={!notifyStudents}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>Also queue browser push for students who enabled it</span>
          </label>
        </fieldset>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-primary">{success}</p>}

      <div className="flex flex-wrap gap-2 pt-1">
        {/* Save as draft (is_published defaults to false in createAnnouncement when publish not set) */}
        {!announcement && (
          <Button type="submit" variant="outline" disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save draft
          </Button>
        )}
        {/* Publish immediately */}
        {!announcement && (
          <Button
            type="button"
            disabled={isPending}
            onClick={() => {
              const form = formRef.current;
              if (!form) return;
              const fd = new FormData(form);
              fd.set("publish", "true");
              handlePublish(fd);
            }}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Publish now
          </Button>
        )}
        {/* Edit existing */}
        {announcement && (
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        )}
      </div>
    </form>
  );
}
