import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { InlineError, EmptyView } from "../../components/ui/Feedback";
import { SegmentedControl } from "../../components/ui";
import { getLmsProgressOverview, getLmsAcademicInsights, getLmsUnifiedInsights, getLmsStreak } from "../../lib/lms/index";
import { getErpBatch } from "../../lib/erp";
import { executePipeline } from "../../lib/erp/erpTransformers";
import type {
  CourseRegistrationModel,
  CurriculumModel,
  CurrentResultModel,
} from "../../lib/erp/erpTransformers";
import { extractCgpaSummary } from "../ERP/ResultsCurrentPage";
import { useNavigate } from "react-router-dom";
import { TABS } from "./hub/types";
import type {
  HistoryData,
  InsightsData,
  KpiItem,
  OverviewData,
  PlannerPrefill,
  Tab,
  UnifiedData,
} from "./hub/types";
import { TabIcon } from "./hub/controls";
import { OverviewTab } from "./hub/OverviewTab";
import { HistoryTab } from "./hub/HistoryTab";
import { PlannerTab } from "./hub/PlannerTab";
import { RisksTab } from "./hub/RisksTab";
import { ActionTab } from "./hub/ActionTab";

export default function AcademicHubPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [plannerPrefill, setPlannerPrefill] = useState<PlannerPrefill | null>(null);
  const [plannerLoading, setPlannerLoading] = useState(false);

  // Phase 5: four independent insight queries. unified/streak are treated as
  // supplementary (null on failure) exactly like the old allSettled contract.
  const overviewQuery = useQuery({
    queryKey: ["lms", "progress-overview"],
    queryFn: () => getLmsProgressOverview(),
    staleTime: 30_000,
  });
  const insightsQuery = useQuery({
    queryKey: ["lms", "academic-insights"],
    queryFn: () => getLmsAcademicInsights(),
    staleTime: 30_000,
  });
  const unifiedQuery = useQuery({
    queryKey: ["lms", "unified-insights"],
    queryFn: () => getLmsUnifiedInsights().catch(() => null),
    staleTime: 30_000,
  });
  const streakQuery = useQuery({
    queryKey: ["lms", "streak"],
    queryFn: () => getLmsStreak().catch(() => null),
    staleTime: 60_000,
  });

  const overview = (overviewQuery.data ?? null) as OverviewData | null;
  const insights = (insightsQuery.data ?? null) as InsightsData | null;
  const unified = (unifiedQuery.data ?? null) as UnifiedData | null;
  const streak = (streakQuery.data ?? null) as { currentStreak: number; longestStreak: number } | null;
  const error =
    overviewQuery.isError && insightsQuery.isError
      ? "Could not load academic data. Please try again."
      : null;
  const loading = overviewQuery.isPending || insightsQuery.isPending || unifiedQuery.isPending || streakQuery.isPending;

  const loadHistory = async () => {
    if (history) return;
    setHistoryLoading(true);
    try {
      const batch = await getErpBatch([
        "examination/exam-mark-details",
        "examination/current-semester-results",
        "examination/internal-mark-details",
        "academic/course-registration",
        "academic/student-wise-subjects",
      ]);
      const marksResult = batch["examination/exam-mark-details"];
      const marksData = (marksResult as any)?.data;
      if (marksData) {
        const parsed = executePipeline("exam-mark-details", marksData);
        const records = (parsed.data as any)?.records || [];
        // Group records by semester
        const semesterMap = new Map<string, typeof records>();
        for (const record of records) {
          const sem = record.semesterNo || "Unknown";
          if (!semesterMap.has(sem)) {
            semesterMap.set(sem, []);
          }
          semesterMap.get(sem)!.push(record);
        }
        const semesters = Array.from(semesterMap.entries()).map(([semesterNo, subjects]) => ({
          semesterNo,
          subjects,
        }));
        setHistory({ semesters });
      }
    } catch {
      // history may not be available
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadPlannerPrefill = async () => {
    if (plannerPrefill || plannerLoading) return;
    setPlannerLoading(true);
    try {
      const batch = await getErpBatch([
        "examination/current-semester-results",
        "academic/course-registration",
        "academic/student-wise-subjects",
        "academic/cgpa-summary",
      ]);
      const resultsModel = executePipeline("results-current", batch);
      const coursePayload = (batch["academic/course-registration"] as any)?.data;
      const courseModel = coursePayload ? executePipeline("course-registration", coursePayload) : null;
      const curriculumPayload = (batch["academic/student-wise-subjects"] as any)?.data;
      const curriculumModel = curriculumPayload ? executePipeline("curriculum", curriculumPayload) : null;
      setPlannerPrefill({
        currentCourse: courseModel?.isValid ? (courseModel.data as CourseRegistrationModel) : null,
        curriculum: curriculumModel?.isValid ? (curriculumModel.data as CurriculumModel) : null,
        currentResults: resultsModel?.isValid ? (resultsModel.data as CurrentResultModel) : null,
        cgpaSummary: extractCgpaSummary((batch["academic/cgpa-summary"] as any)?.data),
      });
    } catch {
      // prefill is best-effort; manual mode still works without it
    } finally {
      setPlannerLoading(false);
    }
  };

  const kpis = useMemo<KpiItem[]>(() => {
    if (!overview) return [];
    const cgpaTrend = insights?.gpaTrend && insights.gpaTrend.length >= 2
      ? (insights.gpaTrend[insights.gpaTrend.length - 1].sgpa - insights.gpaTrend[insights.gpaTrend.length - 2].sgpa)
      : 0;
    return [
      { label: "Current CGPA", value: overview.currentCgpa || "—", trend: cgpaTrend, trendLabel: "vs last sem" },
      { label: "Degree Progress", value: `${overview.progressPercent || 0}%`, subtitle: `${overview.completedCredits}/${overview.requiredCredits} credits` },
      { label: "Attendance", value: `${overview.attendancePct || "—"}%`, trend: parseFloat(overview.attendancePct) >= 75 ? 1 : -1, trendLabel: parseFloat(overview.attendancePct) >= 75 ? "Safe" : "At risk" },
      { label: "Study Streak", value: streak ? `${streak.currentStreak} days` : "—", subtitle: streak ? `Best: ${streak.longestStreak} days` : undefined },
    ];
  }, [overview, insights, streak]);

  const handleQuickAction = (route: string) => {
    navigate(route);
  };

  return (
    <ErpPageShell
      title="Academic Hub"
      source="Internal API"
      isLoading={loading}
      loadingMessage="Loading academic data..."
      loadingVariant="stats"
    >
      {error && <InlineError message={error} onRetry={() => window.location.reload()} />}

      {!loading && !error && (
        <div className="space-y-6">
          <SegmentedControl<Tab>
            ariaLabel="Academic hub sections"
            fluid
            value={activeTab}
            onChange={(key) => {
              setActiveTab(key);
              if (key === "history" && !history) loadHistory();
              if (key === "planner" && !plannerPrefill) loadPlannerPrefill();
            }}
            options={TABS.map((tab) => ({
              value: tab.key,
              label: (
                <>
                  <TabIcon icon={tab.key} />
                  {tab.label}
                </>
              ),
            }))}
          />

          {activeTab === "overview" && (
            <OverviewTab
              overview={overview}
              insights={insights}
              kpis={kpis}
              onQuickAction={handleQuickAction}
            />
          )}

          {activeTab === "history" && (
            <HistoryTab
              history={history}
              historyLoading={historyLoading}
              overview={overview}
              onLoadHistory={loadHistory}
            />
          )}

          {activeTab === "planner" && (
            <PlannerTab
              overview={overview}
              insights={insights}
              plannerPrefill={plannerPrefill}
              plannerLoading={plannerLoading}
            />
          )}

          {activeTab === "risks" && (
            <RisksTab
              overview={overview}
              insights={insights}
              unified={unified}
            />
          )}

          {activeTab === "action" && (
            <ActionTab
              unified={unified}
              onQuickAction={handleQuickAction}
            />
          )}
        </div>
      )}

      {!loading && !error && !overview && (
        <EmptyView
          title="No academic data available"
          description="Academic data will appear here once your profile is synchronized with the university ERP."
          actionLabel="Open Career Profile"
          onAction={() => navigate("/career/me/profile")}
        />
      )}
    </ErpPageShell>
  );
}
