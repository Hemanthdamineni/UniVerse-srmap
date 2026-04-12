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
      <div className="flex items-center gap-2">
        <div className="animate-spin h-4 w-4 border-b-2 border-[#0A3035] rounded-full" />
        <span>Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (profileError) {
    return <div className="text-red-500">Profile Error: {profileError}</div>;
  }

  if (!profileData) {
    return <div className="text-red-500">Profile Error: No profile data available for the current session.</div>;
  }

  return (
    <div ref={dashboardRef} className="grid-rows-12 grid grid-cols-12 p-4 gap-4 h-screen">
      {/* Welcome Card - 1 row */}
      <div data-page-contrast="true" className="page-contrast-fg bg-transparent col-span-9 row-span-1 rounded-xl p-4">
        <WelcomeCard />
      </div>

      {/* Weekly Calendar - 2 rows 3 columns */}
      <div className="dashboard-card col-span-3 row-span-2 p-4">
        <WeekCalendar onDateSelect={setSelectedDate} />
      </div>

      {/* Basic Info - 3 rows 9 columns*/}
      <div className="dashboard-card grid grid-rows-4 grid-cols-12 grid-flow-row-dense gap-2 p-4 col-span-9 row-span-3">
        <h1 className="row-span-1 col-span-12 font-bold text-lg">Basic Info</h1>
        <BasicInfo profileData={profileData} />
      </div>

      {/* Schedule - 10 rows 3 columns */}
      <div className="dashboard-card col-span-3 row-span-10">
        <Schedule scheduleData={timetableData || data} selectedDate={selectedDate} />
      </div>

      {/* Quick Links - 4 rows */}
      <div className="dashboard-card col-span-2 row-span-4 overflow-hidden">
        <QuickLinks feedbackPendingCount={feedbackPendingCount} />
      </div>

      {/* Internal Marks - 4 rows */}
      <div className="dashboard-card col-span-4 row-span-4 overflow-hidden">
        <InternalMarks marksData={data} />
      </div>

      {/* Attendance - 4 rows */}
      <div className="dashboard-card col-span-3 row-span-4 overflow-y-auto">
        <Attendance attendanceData={data} />
      </div>

      {/* ToDo - 4 rows */}
      <div className="dashboard-card col-span-9 row-span-4 overflow-y-auto">
        <ToDo selectedDate={selectedDate} profileData={profileData} />
      </div>
    </div>
  );
}

export default Dashboard;
