import { useEffect, useMemo, useState } from "react";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { InlineError, EmptyView } from "../../components/ui/Feedback";
import { SegmentedControl } from "../../components/ui";
import { getLmsProgressOverview, getLmsAcademicInsights, getLmsUnifiedInsights, getLmsStreak } from "../../lib/lms/index";
import { getErpBatch } from "../../lib/erp";
import { executePipeline } from "../../lib/erp/erpTransformers";
import { useNavigate } from "react-router-dom";
import { TABS } from "./hub/types";
import type {
  HistoryData,
  InsightsData,
  KpiItem,
  OverviewData,
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
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [unified, setUnified] = useState<UnifiedData | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [streak, setStreak] = useState<{ currentStreak: number; longestStreak: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      getLmsProgressOverview(),
      getLmsAcademicInsights(),
      getLmsUnifiedInsights().catch(() => null),
      getLmsStreak().catch(() => null),
    ]).then((results) => {
      if (!active) return;
      const [progressRes, insightsRes, unifiedRes, streakRes] = results;

      if (progressRes.status === "fulfilled" && progressRes.value) {
        setOverview(progressRes.value as OverviewData);
      }
      if (insightsRes.status === "fulfilled" && insightsRes.value) {
        setInsights(insightsRes.value as InsightsData);
      }
      if (unifiedRes.status === "fulfilled" && (unifiedRes as PromiseFulfilledResult<UnifiedData>).value) {
        setUnified((unifiedRes as PromiseFulfilledResult<UnifiedData>).value as UnifiedData);
      }
      if (streakRes.status === "fulfilled" && streakRes.value) {
        setStreak(streakRes.value as { currentStreak: number; longestStreak: number });
      }

      const hasError = progressRes.status === "rejected" && insightsRes.status === "rejected";
      if (hasError) setError("Could not load academic data. Please try again.");
      else setError(null);
      setLoading(false);
    }).catch((err) => {
      if (active) {
        setError(err instanceof Error ? err.message : "Failed to load academic data.");
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

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
