import { DashboardShell } from "@/components/shared/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { StudyPlannerContainer } from "@/components/shared/study-planner/study-planner-container";
import { requireUserSession } from "@/lib/supabase/auth";
import { getLagosNow, addDays } from "@/lib/dates";
import {
  getCourses,
  getStudySessionsForDateRange,
  getOfficialLecturesForDateRange,
} from "@/features/study-planner/queries";

export const dynamic = "force-dynamic";

export default async function StudyPlannerPage() {
  const user = await requireUserSession();
  const { date: todayDate } = getLagosNow();

  // Load an initial 6-week window (-2 weeks to +4 weeks)
  const rangeStart = addDays(todayDate, -14);
  const rangeEnd = addDays(todayDate, 28);

  const [courses, studySessions, lectures] = await Promise.all([
    getCourses(),
    getStudySessionsForDateRange(user.id, rangeStart, rangeEnd),
    getOfficialLecturesForDateRange(rangeStart, rangeEnd),
  ]);

  return (
    <DashboardShell currentLabel="Study Planner">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Personal study timetable"
          title="Personal Study Planner"
          description="Build your revision rhythm around the 200-level Civil Engineering timetable. Your study sessions remain private to your account."
        />

        <StudyPlannerContainer
          courses={courses}
          initialStudySessions={studySessions}
          initialLectures={lectures}
          todayDate={todayDate}
        />
      </div>
    </DashboardShell>
  );
}
