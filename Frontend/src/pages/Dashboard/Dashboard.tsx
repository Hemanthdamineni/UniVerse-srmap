// Dashboard grid unchanged; widgets use SectionCard/SkeletonCard/InlineError from shared UI.
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import BasicInfo from "./BasicInfo";
import Schedule from "./Schedule";
const Attendance = lazy(() => import("./Attendance"));
const InternalMarks = lazy(() => import("./InternalMarks"));
import QuickLinks from "./QuickLinks";
import WeekCalendar from "./WeekCalendar";
import ToDo from "./ToDo";
import WelcomeCard from "./WelcomeCard";
import UpcomingEventsWidget from "./UpcomingEventsWidget";
import CareerWidget from "./CareerWidget";
import { usePageContrast } from "../../hooks/usePageContrast";
import { fetchSessionProfile, getSessionId } from "../../lib/core/session";
import { getErpBatch } from "../../lib/erp/index";
import { getEndSemesterFeedbackStatus } from "../../lib/campus/studentToolsApi";
import { InlineError } from "../../components/ui/Feedback";
import { SectionCard } from "../../components/ui/SectionCard";
import { SkeletonCard } from "../../components/ui/Skeletons";
import { DashboardLayout } from "../../components/layout/PageLayouts";

function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [feedbackPendingCount, setFeedbackPendingCount] = useState(0);
  const dashboardRef = useRef<HTMLDivElement | null>(null);

  usePageContrast(dashboardRef, [loading, profileLoading, error, profileError, selectedDate]);

  useEffect(() => {
    const sessionId = getSessionId();

    if (!sessionId) {
      setError("Your session has expired. Please log in to continue.");
      setLoading(false);
      setProfileLoading(false);
      return;
    }

    // Fetch each widget's data as separate page keys so that the
    // transformers receive a correctly shaped batch object keyed by
    // page key (with _extracted embedded by the backend extractor).
    setLoading(true);
    getErpBatch([
      "academic/time-table",
      "examination/internal-mark-details",
      "academic/attendance-details",
    ])
      .then((batch) => {
        // Pass the full batch to setData so widgets can call
        // readExtractedPage(rawData, "<pageKey>") correctly.
        setData(batch);
        setLoading(false);
      })
      .catch((err: Error) => { setError(err.message); setLoading(false); });

    setProfileLoading(true);
    fetchSessionProfile()
      .then((profile) => {
        setProfileData(profile);
        setProfileLoading(false);
      })
      .catch((err: Error) => {
        setProfileError(err.message || 'No profile data available');
        setProfileLoading(false);
      });

    getEndSemesterFeedbackStatus()
      .then((status) => {
        setFeedbackPendingCount(status.totalPending || 0);
      })
      .catch(() => {
        setFeedbackPendingCount(0);
      });
  }, []);

  if (loading || profileLoading) {
    return (
      <DashboardLayout>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="space-y-4 md:col-span-9">
          <SkeletonCard className="h-12" />
          <SkeletonCard className="h-[180px]" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-9">
            <SkeletonCard className="h-[220px] md:col-span-2" />
            <SkeletonCard className="h-[220px] md:col-span-4" />
            <SkeletonCard className="h-[220px] md:col-span-3" />
          </div>
          <SkeletonCard className="h-[230px]" />
        </div>
        <div className="space-y-4 md:col-span-3">
          <SkeletonCard className="h-[180px]" />
          <SkeletonCard className="h-[500px]" />
        </div>
      </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <InlineError
          title="Dashboard could not load"
          message={error}
          description="Your ERP session may have expired, or the student data service may be temporarily unavailable."
        />
      </DashboardLayout>
    );
  }

  if (profileError) {
    return (
      <DashboardLayout>
        <InlineError
          title="Profile could not load"
          message={profileError}
          description="The rest of the student workspace needs your profile to personalize timetable, attendance, and quick actions."
        />
      </DashboardLayout>
    );
  }

  if (!profileData) {
    return (
      <DashboardLayout>
        <InlineError
          title="Profile could not load"
          message="No profile data is available for the current session."
          description="Sign in again if this continues, then return to the dashboard."
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
    <div ref={dashboardRef} className="grid grid-cols-1 gap-4 md:grid-cols-12">
      <div className="space-y-4 md:col-span-9">
        <div data-page-contrast="true" className="page-contrast-fg">
          <WelcomeCard profileData={profileData} />
        </div>

        <SectionCard interactive title="Basic Info" className="overflow-hidden p-4">
          <BasicInfo profileData={profileData} />
        </SectionCard>

        <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-12">
          {/* Row 1: Academic Data (7/5 split) */}
          <SectionCard interactive className="overflow-hidden p-0 md:col-span-7 min-h-[320px]">
            <Suspense fallback={<SkeletonCard className="h-[320px] w-full" />}>
              <InternalMarks marksData={data} />
            </Suspense>
          </SectionCard>

          <SectionCard interactive className="overflow-hidden p-0 md:col-span-5 min-h-[320px]">
            <Suspense fallback={<SkeletonCard className="h-[320px] w-full" />}>
              <Attendance attendanceData={data} />
            </Suspense>
          </SectionCard>

          {/* Row 2: Navigation & Discovery (4/4/4 split) */}
          <SectionCard interactive className="overflow-hidden p-0 md:col-span-4 min-h-[280px]">
            <QuickLinks feedbackPendingCount={feedbackPendingCount} />
          </SectionCard>

          <SectionCard interactive className="overflow-hidden p-0 md:col-span-4 min-h-[280px]">
            <UpcomingEventsWidget />
          </SectionCard>

          <SectionCard interactive className="overflow-hidden p-0 md:col-span-4 min-h-[280px]">
            <CareerWidget />
          </SectionCard>
        </div>

        <SectionCard interactive className="overflow-hidden p-0">
          <ToDo selectedDate={selectedDate} profileData={profileData} />
        </SectionCard>
      </div>

      <div className="space-y-4 md:col-span-3">
        <SectionCard interactive className="overflow-hidden p-3">
          <WeekCalendar onDateSelect={setSelectedDate} />
        </SectionCard>

        <SectionCard interactive className="overflow-hidden p-0">
          <Schedule scheduleData={data} selectedDate={selectedDate} />
        </SectionCard>
      </div>
    </div>
    </DashboardLayout>
  );
}

export default Dashboard;
