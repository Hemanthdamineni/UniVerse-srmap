// Dashboard grid unchanged; widgets use SectionCard/SkeletonCard/InlineError from shared UI.
import { useEffect, useRef, useState } from "react";
import BasicInfo from "./BasicInfo";
import Schedule from "./Schedule";
import Attendance from "./Attendance";
import InternalMarks from "./InternalMarks";
import QuickLinks from "./QuickLinks";
import WeekCalendar from "./WeekCalendar";
import ToDo from "./ToDo";
import WelcomeCard from "./WelcomeCard";
import { usePageContrast } from "../../hooks/usePageContrast";
import { fetchSessionProfile, getSessionId } from "../../lib/session";
import { getErpBatch } from "../../lib/erpApi";
import { getEndSemesterFeedbackStatus } from "../../lib/studentToolsApi";
import { InlineError } from "../../components/ui/InlineError";
import { SectionCard } from "../../components/ui/SectionCard";
import { SkeletonCard } from "../../components/ui/SkeletonCard";

function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [timetableData, setTimetableData] = useState<any>(null);
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
      setError("Not logged in. Please log in to view the dashboard.");
      setLoading(false);
      setProfileLoading(false);
      return;
    }

    // Fetch dashboard data and timetable data
    setLoading(true);
    getErpBatch(["dashboard", "academic/time-table"])
      .then((batch) => {
        if (batch["dashboard"]) {
           setData((batch["dashboard"] as any)?.data);
        }
        if (batch["academic/time-table"]) {
           setTimetableData((batch["academic/time-table"] as any)?.data);
        }
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
      <div className="grid grid-cols-12 gap-4 p-4 h-screen">
        {/* Welcome skeleton */}
        <div className="col-span-9"><SkeletonCard className="h-48" /></div>
        <div className="col-span-3"><SkeletonCard className="h-48" /></div>
        {/* Basic info skeleton */}
        <div className="col-span-9"><SkeletonCard className="h-[180px]" /></div>
        {/* Schedule skeleton */}
        <div className="col-span-3 row-span-2"><SkeletonCard className="h-[400px]" /></div>
        {/* Bottom cards */}
        <div className="col-span-2"><SkeletonCard className="h-[200px]" /></div>
        <div className="col-span-4"><SkeletonCard className="h-[200px]" /></div>
        <div className="col-span-3"><SkeletonCard className="h-[200px]" /></div>
        <div className="col-span-9"><SkeletonCard className="h-[200px]" /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <InlineError message={error} />
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="p-6">
        <InlineError message={`Profile Error: ${profileError}`} />
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="p-6">
        <InlineError message="Profile Error: No profile data available for the current session." />
      </div>
    );
  }

  return (
    <div ref={dashboardRef} className="grid-rows-12 grid grid-cols-12 p-4 gap-4 h-screen">
      {/* Welcome Card - 1 row */}
      <SectionCard data-page-contrast="true" className="page-contrast-fg bg-transparent col-span-9 row-span-1 p-0 border-0 shadow-none">
        <WelcomeCard />
      </SectionCard>

      {/* Weekly Calendar - 2 rows 3 columns */}
      <SectionCard interactive className="col-span-3 row-span-2 p-0 overflow-hidden">
        <WeekCalendar onDateSelect={setSelectedDate} />
      </SectionCard>

      {/* Basic Info - 3 rows 9 columns*/}
      <SectionCard interactive title="Basic Info" className="col-span-9 row-span-3 overflow-hidden">
        <BasicInfo profileData={profileData} />
      </SectionCard>

      {/* Schedule - 10 rows 3 columns */}
      <SectionCard interactive className="col-span-3 row-span-10 p-0 overflow-hidden">
        <Schedule scheduleData={timetableData || data} selectedDate={selectedDate} />
      </SectionCard>

      {/* Quick Links - 4 rows */}
      <SectionCard interactive className="col-span-2 row-span-4 p-0 overflow-hidden">
        <QuickLinks feedbackPendingCount={feedbackPendingCount} />
      </SectionCard>

      {/* Internal Marks - 4 rows */}
      <SectionCard interactive className="col-span-4 row-span-4 p-0 overflow-hidden">
        <InternalMarks marksData={data} />
      </SectionCard>

      {/* Attendance - 4 rows */}
      <SectionCard interactive className="col-span-3 row-span-4 p-0 overflow-hidden">
        <Attendance attendanceData={data} />
      </SectionCard>

      {/* ToDo - 4 rows */}
      <SectionCard interactive className="col-span-9 row-span-4 p-0 overflow-hidden">
        <ToDo selectedDate={selectedDate} profileData={profileData} />
      </SectionCard>
    </div>
  );
}

export default Dashboard;
