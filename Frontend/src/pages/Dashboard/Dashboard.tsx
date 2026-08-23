// Dashboard grid unchanged; widgets use SectionCard/SkeletonCard/InlineError from shared UI.
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import BasicInfo from "./BasicInfo";
import Schedule from "./Schedule";
const Attendance = lazy(() => import("./Attendance"));
// InternalMarks is intentionally not rendered on the dashboard anymore.
// The component (and its tests) stay intact in ./InternalMarks.tsx for future reuse.
// const InternalMarks = lazy(() => import("./InternalMarks"));
import QuickLinks from "./QuickLinks";
import WeekCalendar from "./WeekCalendar";
import ToDo from "./ToDo";
import WelcomeCard from "./WelcomeCard";
import FirstRunGuide from "./FirstRunGuide";
import CampusHubWidget from "./CampusHubWidget";
import { usePageContrast } from "../../hooks/usePageContrast";
import { fetchSessionProfile, hasSessionAuth } from "../../lib/core/session";
import { sessionKeys } from "../../lib/core/queryKeys";
import { hasSeenOnboarding } from "../../lib/core/onboarding";
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
  const [showFirstRunGuide, setShowFirstRunGuide] = useState(() => !hasSeenOnboarding());
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  usePageContrast(dashboardRef, [loading, profileLoading, error, profileError, selectedDate]);

  useEffect(() => {
    let active = true;

    if (!hasSessionAuth()) {
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
      "academic/attendance-details",
    ])
      .then((batch) => {
        if (!active) return;
        // Pass the full batch to setData so widgets can call
        // readExtractedPage(rawData, "<pageKey>") correctly.
        setData(batch);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
        setLoading(false);
      });

    setProfileLoading(true);
    // Shared ['session','profile'] cache — dedups with Sidebar/Blueprint.
    queryClient
      .fetchQuery({ queryKey: sessionKeys.profile, queryFn: fetchSessionProfile })
      .then((profile) => {
        if (!active) return;
        setProfileData(profile);
        setProfileLoading(false);
      })
      .catch((err: Error) => {
        if (!active) return;
        setProfileError(err.message || 'No profile data available');
        setProfileLoading(false);
      });

    getEndSemesterFeedbackStatus()
      .then((status) => {
        if (!active) return;
        setFeedbackPendingCount(status.totalPending || 0);
      })
      .catch(() => {
        if (!active) return;
        setFeedbackPendingCount(0);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading || profileLoading) {
    return (
      <DashboardLayout>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 xl:h-[calc(100vh-var(--dash-chrome))]">
        <div className="grid gap-4 md:col-span-9">
          <SkeletonCard className="h-14" />
          <SkeletonCard className="h-[150px]" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SkeletonCard className="h-[280px]" />
            <SkeletonCard className="h-[280px]" />
            <SkeletonCard className="h-[280px]" />
          </div>
          <SkeletonCard className="h-[170px]" />
        </div>
        <div className="grid gap-4 md:col-span-3">
          <SkeletonCard className="h-[180px]" />
          <SkeletonCard className="h-[420px]" />
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
    <div ref={dashboardRef} className="grid grid-cols-1 gap-4 md:grid-cols-12 xl:h-[calc(100vh-var(--dash-chrome))]">
      {/* Vertical share: welcome/basic info size to content, widget row gets
          3 parts and To-Do 2 parts of the remaining height. Minimums keep
          card controls (tabs, CTAs) usable on shorter desktop screens. The
          one-time first-run guide adds its own auto row while visible. */}
      {/* Mobile (<md): both zone wrappers dissolve via display:contents so the
          leaf cards interleave in reading order — Welcome → Basic Info →
          Week Calendar → Schedule → Attendance → Quick Links → Campus Hub →
          To-Do (the max-md:order utilities lift the rail pair above the
          engagement row). md+: wrappers are real grid zones again
          (main 9 / rail 3) and every max-md:* utility goes inert, so the xl
          two-zone template lays out exactly as before. */}
      <div className={`grid min-h-0 gap-4 max-md:contents md:col-span-9 ${showFirstRunGuide ? "grid-rows-[auto_auto_auto_minmax(340px,3fr)_minmax(210px,2fr)]" : "grid-rows-[auto_auto_minmax(340px,3fr)_minmax(210px,2fr)]"}`}>
        <div data-page-contrast="true" className="page-contrast-fg">
          {/* Card chassis required: with the flat page surface the brand wedge
              passes behind this bare block on narrow viewports and the greeting
              rendered dark-on-dark (~1.1:1). Opaque card restores legibility. */}
          <SectionCard className="overflow-hidden p-4">
            <WelcomeCard profileData={profileData} />
          </SectionCard>
        </div>

        {showFirstRunGuide && (
          <FirstRunGuide onDismiss={() => setShowFirstRunGuide(false)} />
        )}

        <SectionCard interactive title="Basic Info" className="overflow-hidden p-4">
          <BasicInfo profileData={profileData} />
        </SectionCard>

        {/* Single row: Attendance | Student Tasks | Campus Hub. At mobile the
            row group sorts after the rail pair (max-md:order-2) and within it
            Attendance leads (primary daily check) — desktop cells unchanged. */}
        <div className="grid min-h-0 grid-cols-1 items-stretch gap-4 max-md:order-2 md:grid-cols-2 xl:grid-cols-3">
          <SectionCard interactive className="min-h-[280px] overflow-hidden p-0 xl:min-h-0 max-md:order-2">
            <QuickLinks feedbackPendingCount={feedbackPendingCount} />
          </SectionCard>

          <SectionCard interactive className="min-h-[280px] overflow-hidden p-0 xl:min-h-0 max-md:order-3">
            <CampusHubWidget />
          </SectionCard>

          {/* Attendance width reduced from 5 to 3 columns (equal thirds) */}
          <SectionCard interactive className="min-h-[280px] overflow-hidden p-0 md:col-span-2 xl:col-span-1 xl:min-h-0 max-md:order-1">
            <Suspense fallback={<SkeletonCard className="h-full w-full" />}>
              <Attendance attendanceData={data} />
            </Suspense>
          </SectionCard>
        </div>

        <SectionCard interactive className="overflow-hidden p-0 max-md:order-2">
          <ToDo selectedDate={selectedDate} profileData={profileData} />
        </SectionCard>
      </div>

      {/* Rail dissolves into the outer grid below md so Week Calendar and
          Schedule can slot in after Basic Info (max-md:order-1). */}
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 max-md:contents md:col-span-3">
        <SectionCard interactive className="overflow-hidden p-4 max-md:order-1">
          <WeekCalendar onDateSelect={setSelectedDate} />
        </SectionCard>

        <SectionCard interactive className="overflow-hidden p-0 max-md:order-1">
          <Schedule scheduleData={data} selectedDate={selectedDate} />
        </SectionCard>
      </div>
    </div>
    </DashboardLayout>
  );
}

export default Dashboard;
