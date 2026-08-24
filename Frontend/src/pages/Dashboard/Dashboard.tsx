// Dashboard grid unchanged; widgets use SectionCard/SkeletonCard/InlineError from shared UI.
import { useRef, useState, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { fetchSessionProfile, hasSessionAuth, readStoredProfileData } from "../../lib/core/session";
import { sessionKeys } from "../../lib/core/queryKeys";
import { erpKeys } from "../../lib/erp/queryKeys";
import { hasSeenOnboarding } from "../../lib/core/onboarding";
import { getErpBatch } from "../../lib/erp/index";
import { getEndSemesterFeedbackStatus } from "../../lib/campus/studentToolsApi";
import { InlineError } from "../../components/ui/Feedback";
import { SectionCard } from "../../components/ui/SectionCard";
import { SkeletonCard } from "../../components/ui/Skeletons";
import { DashboardLayout } from "../../components/layout/PageLayouts";

function Dashboard() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showFirstRunGuide, setShowFirstRunGuide] = useState(() => !hasSeenOnboarding());
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  // Phase 5: three independent queries. Each widget class renders as soon as
  // its own inputs are ready instead of gating on the slowest of three loads.
  const hasAuth = hasSessionAuth();
  const DASHBOARD_BATCH_KEYS = ["academic/time-table", "academic/attendance-details"] as const;

  const erpBatchQuery = useQuery({
    queryKey: erpKeys.batch(DASHBOARD_BATCH_KEYS),
    queryFn: () => getErpBatch([...DASHBOARD_BATCH_KEYS]),
    enabled: hasAuth,
    staleTime: 60_000,
  });

  const profileQuery = useQuery({
    queryKey: sessionKeys.profile,
    queryFn: fetchSessionProfile,
    initialData: () => readStoredProfileData() ?? undefined,
    staleTime: 30_000,
    enabled: hasAuth,
    retry: false,
  });

  const feedbackQuery = useQuery({
    queryKey: ["feedback", "end-semester-status"],
    queryFn: getEndSemesterFeedbackStatus,
    enabled: hasAuth,
    staleTime: 60_000,
    retry: false,
  });

  // Full batch passed to widgets so they can readExtractedPage(rawData, "<pageKey>").
  const data = erpBatchQuery.data ?? null;
  // Disabled queries stay pending forever, so gate on auth explicitly to
  // match the pre-migration behavior of clearing loaders on the no-session path.
  const loading = hasAuth && erpBatchQuery.isPending;
  const error: string | null = !hasAuth
    ? "Your session has expired. Please log in to continue."
    : erpBatchQuery.error instanceof Error
      ? erpBatchQuery.error.message
      : erpBatchQuery.error
        ? "Failed to load dashboard data."
        : null;

  const profileData = profileQuery.data ?? null;
  const profileLoading = hasAuth && profileQuery.isPending;
  const profileError: string | null = profileQuery.error
    ? profileQuery.error.message || "No profile data available"
    : null;

  const feedbackPendingCount = feedbackQuery.data?.totalPending || 0;

  usePageContrast(dashboardRef, [loading, profileLoading, error, profileError, selectedDate]);

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
