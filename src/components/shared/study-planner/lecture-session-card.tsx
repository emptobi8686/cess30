import { GraduationCap, Clock, MapPin, User, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/dates";
import type { LectureSessionWithCourse } from "@/types";

type Props = {
  lecture: LectureSessionWithCourse;
};

export function LectureSessionCard({ lecture }: Props) {
  return (
    <div
      className={`rounded-xl border p-3.5 transition-colors ${
        lecture.is_cancelled
          ? "border-destructive/20 bg-destructive/5 opacity-70"
          : "border-border/80 bg-muted/30"
      }`}
    >
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] h-5 bg-muted text-muted-foreground border-border/80">
              <GraduationCap className="h-3 w-3 mr-1" />
              Official Lecture
            </Badge>

            <span className="font-mono text-xs font-bold text-foreground">
              {lecture.courses.course_code}
            </span>
          </div>

          {lecture.is_cancelled ? (
            <Badge variant="destructive" className="text-[10px] h-5 gap-1">
              <AlertCircle className="h-3 w-3" />
              Cancelled
            </Badge>
          ) : null}
        </div>

        <p className="text-xs font-medium text-foreground line-clamp-1">
          {lecture.courses.course_title}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-0.5">
          <span className="inline-flex items-center gap-1 font-mono">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(lecture.start_time)} – {formatTime(lecture.end_time)}
          </span>

          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {lecture.venue}
          </span>

          {lecture.lecturer_name ? (
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {lecture.lecturer_name}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

