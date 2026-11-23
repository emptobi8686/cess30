import { DashboardShell } from "@/components/shared/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { StudyPlannerContainer } from "@/components/shared/study-planner/study-planner-container";
import { requireUserSession } from "@/lib/supabase/auth";
import { getLagosNow, isValidDateString } from "@/lib/dates";
import { loadedRangeFor, parsePlannerView } from "@/features/study-planner/range";
import {
  getCourses,
  getStudySessionsForDateRange,
  getOfficialLecturesForDateRange,
} from "@/features/study-planner/queries";

export const dynamic = "force-dynamic";

export default async function StudyPlannerPage(props: PageProps<"/study-planner">) {
  const user = await requireUserSession();
  const searchParams = await props.searchParams;
  const { date: todayDate } = getLagosNow();

  const requestedDate = typeof searchParams.date === "string" ? searchParams.date : "";
  const anchorDate = isValidDateString(requestedDate) ? requestedDate : todayDate;
  const initialView = parsePlannerView(searchParams.view);

  // Load every date any planner view can show around the anchor (BP-038).
  const loadedRange = loadedRangeFor(anchorDate);

  const [courses, studySessions, lectures] = await Promise.all([
    getCourses(),
    getStudySessionsForDateRange(user.id, loadedRange.start, loadedRange.end),
    getOfficialLecturesForDateRange(loadedRange.start, loadedRange.end),
  ]);

  return (
    <DashboardShell currentLabel="Study Planner">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Personal study timetable"
          title="Personal Study Planner"
          description="Plan revision around your lecture timetable. Your study sessions remain private to your account."
        />

        <StudyPlannerContainer
          courses={courses}
          initialStudySessions={studySessions}
          initialLectures={lectures}
          todayDate={todayDate}
          anchorDate={anchorDate}
          initialView={initialView}
          loadedRange={loadedRange}
        />
      </div>
    </DashboardShell>
  );
}
