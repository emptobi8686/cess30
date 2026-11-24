"use client";

import { useState, useTransition } from "react";
import { audienceBadge } from "@/features/audiences/schema";
import { useRouter } from "next/navigation";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AnnouncementForm } from "@/components/shared/announcement-form";
import { formatTimestamp } from "@/lib/dates";
import {
  deleteAnnouncement,
  publishAnnouncement,
  unpublishAnnouncement,
} from "@/features/announcements/actions";
import type { Announcement, Course } from "@/types";


function TogglePublishButton({ announcement }: { announcement: Announcement }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notifyStudents, setNotifyStudents] = useState(false);
  const [sendPush, setSendPush] = useState(false);
  const router = useRouter();

  function handleUnpublish() {
    setError(null);
    startTransition(async () => {
      const result = await unpublishAnnouncement(announcement.id);

      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function handlePublish() {
    setError(null);
    startTransition(async () => {
      const result = await publishAnnouncement(
        announcement.id,
        notifyStudents,
        sendPush
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div>
      {announcement.is_published ? (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={handleUnpublish}
          className="text-xs"
        >
          {isPending ? "…" : "Unpublish"}
        </Button>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <Button size="sm" onClick={() => setOpen(true)} className="text-xs">
            Publish
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Publish announcement</DialogTitle>
              <DialogDescription>
                Notifications are optional. Browser push is only queued for students who enabled it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifyStudents}
                  onChange={(event) => {
                    setNotifyStudents(event.target.checked);
                    if (!event.target.checked) setSendPush(false);
                  }}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>Create an in-app notification for eligible students</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={sendPush}
                  disabled={!notifyStudents}
                  onChange={(event) => setSendPush(event.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>Also queue browser push notifications</span>
              </label>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handlePublish} disabled={isPending}>
                {isPending ? "Publishing…" : "Publish"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function DeleteAnnouncementButton({ announcement }: { announcement: Announcement }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAnnouncement(announcement.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete announcement"
          onClick={() => setOpen(true)} />}
      >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete announcement</DialogTitle>
          <DialogDescription>
            Delete &ldquo;{announcement.title}&rdquo;? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAnnouncementButton({
  announcement,
  courses,
}: {
  announcement: Announcement;
  courses: Course[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Edit announcement" onClick={() => setOpen(true)} />}
      >
          <Edit2 className="h-4 w-4 text-muted-foreground" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit announcement</DialogTitle>
        </DialogHeader>
        <AnnouncementForm
          courses={courses}
          announcement={announcement}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export function AdminAnnouncementsTable({
  announcements,
  courses,
}: {
  announcements: Announcement[];
  courses: Course[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            render={<Button onClick={() => setCreateOpen(true)} />}
          >
              <Plus className="mr-2 h-4 w-4" />
              New announcement
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create announcement</DialogTitle>
              <DialogDescription>
                Save as a draft to review later, or publish immediately.
              </DialogDescription>
            </DialogHeader>
            <AnnouncementForm
              courses={courses}
              onSuccess={() => {
                setCreateOpen(false);
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {announcements.length === 0 ? (
        <Card className="border-dashed border-border bg-muted/30">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No announcements yet. Create your first one above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/80 bg-card overflow-hidden">
          <CardHeader className="border-b border-border/60 pb-3 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {announcements.length} announcement{announcements.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {announcements.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="max-w-[220px] px-4 py-3">
                      <p className="line-clamp-1 font-medium">{a.title}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{a.content}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px]">
                        {audienceBadge(a.announcement_audiences)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {formatTimestamp(a.created_at, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={a.is_published ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {a.is_published ? "Published" : "Draft"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <TogglePublishButton announcement={a} />
                        <EditAnnouncementButton announcement={a} courses={courses} />
                        <DeleteAnnouncementButton announcement={a} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
