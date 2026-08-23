import { useEffect, useState } from "react";
import { getErpBatch } from "../../lib/erp/index";
import { getAcademicCalendar } from "../../lib/erp/calendarApi";
import { executePipeline, type CurriculumModel } from "../../lib/erp/erpTransformers";
import type { AcademicCalendar } from "../../lib/erp/types";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { ErpPageShell } from "../../components/erp/ErpPrimitives";
import { EmptyState, InlineError } from "../../components/ui/Feedback";
import { TermContextStrip } from "./components/TermContextStrip";
import { AcademicTimelineSection } from "./components/AcademicTimelineSection";
import { HolidaysSection } from "./components/HolidaysSection";
import { CurriculumSubjectsSection } from "./components/CurriculumSubjectsSection";
import { handleTabArrowKeys } from "./components/tabKeyboard";

interface CurriculumPageProps {
  blueprint: PageBlueprint;
}

type PageTab = "subjects" | "calendar" | "holidays";

const TABS: Array<{ value: PageTab; label: string }> = [
  { value: "subjects", label: "Curriculum" },
  { value: "calendar", label: "Calendar" },
  { value: "holidays", label: "Holidays" },
];

export default function CurriculumPage({ blueprint }: CurriculumPageProps) {
  const [model, setModel] = useState<CurriculumModel | null>(null);
  const [calendar, setCalendar] = useState<AcademicCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<PageTab>("subjects");

  useEffect(() => {
    let active = true;
    setLoading(true);

    // The two sources are independent: a scraper outage must not hide the calendar.
    const curriculumPromise = getErpBatch(blueprint.fetchKeys)
      .then((batch) => {
        if (!active) return;
        const result = batch["academic/student-wise-subjects"];
        if (!result || (result as any).success === false) {
          setError("Curriculum data unavailable.");
          return;
        }
        const rawData = (result as any).data;
        const pipelineResult = executePipeline(blueprint, rawData);
        if (pipelineResult?.isValid && pipelineResult.data) {
          setError(null);
          setModel(pipelineResult.data as CurriculumModel);
        } else {
          setError("Invalid curriculum data format.");
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError((err as Error)?.message || "Failed to load curriculum.");
      });

    const calendarPromise = getAcademicCalendar()
      .then((data) => {
        if (active) setCalendar(data);
      })
      .catch(() => {
        // Calendar is supplementary on this page; the dedicated tabs surface the failure.
        if (active) setCalendar(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      void curriculumPromise;
      void calendarPromise;
    };
  }, [blueprint.fetchKeys, blueprint, refreshTrigger]);

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      <div className="flex flex-col gap-6">
        {calendar ? <TermContextStrip calendar={calendar} /> : null}

        <div
          role="tablist"
          aria-label="Curriculum page sections"
          className="inline-flex w-fit max-w-full overflow-x-auto rounded-lg border p-1"
          style={{ borderColor: "var(--comp-border)" }}
          onKeyDown={handleTabArrowKeys}
        >
          {TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              type="button"
              aria-selected={activeTab === tab.value}
              data-page-tab={tab.value}
              onClick={() => setActiveTab(tab.value)}
              onKeyDown={handleTabArrowKeys}
              className="rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              style={
                activeTab === tab.value
                  ? { background: "var(--comp-accent)", color: "var(--comp-accent-fg)" }
                  : { color: "var(--comp-text-secondary)" }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <InlineError message={error} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
        )}

        <div role="tabpanel" data-tab-panel={activeTab} className="flex flex-col gap-4">
          {activeTab === "subjects" ? (
            model ? (
              <CurriculumSubjectsSection model={model} />
            ) : (
              !error && (
                <EmptyState
                  title="No curriculum data available"
                  description="Load curriculum data to see your enrolled subjects."
                />
              )
            )
          ) : null}

          {activeTab === "calendar" ? (
            calendar ? (
              <AcademicTimelineSection calendar={calendar} />
            ) : (
              !loading && (
                <InlineError
                  message="Academic calendar is unavailable right now."
                  onRetry={() => setRefreshTrigger((prev) => prev + 1)}
                />
              )
            )
          ) : null}

          {activeTab === "holidays" ? (
            calendar ? (
              <HolidaysSection calendar={calendar} />
            ) : (
              !loading && (
                <InlineError
                  message="Holiday information is unavailable right now."
                  onRetry={() => setRefreshTrigger((prev) => prev + 1)}
                />
              )
            )
          ) : null}
        </div>
      </div>
    </ErpPageShell>
  );
}
