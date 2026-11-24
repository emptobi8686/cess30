"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  archiveCourseAction,
  createCourseAction,
  deleteCourseAction,
  restoreCourseAction,
  updateCourseAction,
} from "@/features/courses/actions";
import { COURSE_LEVELS } from "@/features/courses/validation";
import { useAllowedLevels, useStaffAccess } from "@/components/shared/staff-access";
import { IDLE_ACTION_STATE, type ActionState } from "@/lib/action-state";
import type { CourseWithArchive } from "@/features/courses/queries";

function Status({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p role="status" className={state.status === "error" ? "text-xs text-destructive" : "text-xs text-primary"}>
      {state.message}
    </p>
  );
}

function CourseFields({ idPrefix, course }: { idPrefix: string; course?: CourseWithArchive }) {
  const allowedLevels = useAllowedLevels();
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-code`}>Code</Label>
        <Input id={`${idPrefix}-code`} name="course_code" defaultValue={course?.course_code} placeholder="CEE301" required maxLength={6} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input id={`${idPrefix}-title`} name="course_title" defaultValue={course?.course_title} required minLength={3} maxLength={160} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-units`}>Units</Label>
        <Input id={`${idPrefix}-units`} name="credit_units" type="number" min={1} max={6} defaultValue={course?.credit_units ?? 3} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-level`}>Level</Label>
        <select
          id={`${idPrefix}-level`}
          name="level"
          defaultValue={course?.level ?? (allowedLevels.includes("200") ? "200" : allowedLevels[0])}
          className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
        >
          {COURSE_LEVELS.filter((level) => allowedLevels.includes(level)).map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export function CourseCreateForm() {
  const [state, action, pending] = useActionState(createCourseAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-5">
      <CourseFields idPrefix="new-course" />
      <div className="space-y-2 sm:col-span-5">
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add course"}</Button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function CourseEditForm({ course }: { course: CourseWithArchive }) {
  const [state, action, pending] = useActionState(updateCourseAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-5">
      <input type="hidden" name="courseId" value={course.id} />
      <CourseFields idPrefix={`course-${course.id}`} course={course} />
      <div className="space-y-2 sm:col-span-5">
        <Button type="submit" variant="outline" size="sm" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function CourseLifecycleButtons({ course }: { course: CourseWithArchive }) {
  const [archiveState, archive, archiving] = useActionState(
    course.archived_at ? restoreCourseAction : archiveCourseAction,
    IDLE_ACTION_STATE
  );
  const [deleteState, remove, deleting] = useActionState(deleteCourseAction, IDLE_ACTION_STATE);
  const { isAdmin } = useStaffAccess();
  return (
    <div className="flex flex-wrap items-start gap-3">
      <form action={archive} className="space-y-1">
        <input type="hidden" name="courseId" value={course.id} />
        <Button type="submit" variant="outline" size="sm" disabled={archiving}>
          {course.archived_at ? "Restore" : "Archive"}
        </Button>
        <Status state={archiveState} />
      </form>
      {isAdmin ? (
        <form action={remove} className="space-y-1">
          <input type="hidden" name="courseId" value={course.id} />
          <Button type="submit" variant="destructive" size="sm" disabled={deleting}>Delete</Button>
          <Status state={deleteState} />
        </form>
      ) : null}
    </div>
  );
}
