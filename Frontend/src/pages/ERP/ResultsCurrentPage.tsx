// ResultsCurrentPage - Main orchestrator component (refactored)
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  executePipeline,
  type CourseRegistrationModel,
  type CurrentResultModel,
  type CurriculumModel,
  type InternalMarksModel,
} from "../../lib/erp/erpTransformers";
import { getErpBatch } from "../../lib/erp/index";
import { erpKeys } from "../../lib/erp/queryKeys";
import type { PageBlueprint } from "../../config/erpBlueprints";

import { ErpPageShell, SectionCard, TableCardHeader } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/Feedback";
import { SubjectResultsTable } from "./components/SubjectResultsTable";
import { InternalMarksBundledSection } from "./components/InternalMarksBundledSection";
import { SgpaCgpaPredictor } from "./components/SgpaCgpaPredictor";

// Strips erp-table-shell chrome so SubjectResultsTable reads as one flush
// surface inside the `dashboard-card overflow-hidden p-0` section.
const FLUSH_TABLE_SHELL =
  "[&_.erp-table-shell]:rounded-none [&_.erp-table-shell]:border-0 [&_.erp-table-shell]:shadow-none";

interface Props {
  blueprint: PageBlueprint;
}

function parseSemesterNumber(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  const arabicMatch = normalized.match(/\b(\d{1,2})\b/);
  if (arabicMatch) return Number(arabicMatch[1]);

  const romanMap: Record<string, number> = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
    VIII: 8,
    IX: 9,
    X: 10,
  };

  const romanMatch = normalized.match(/\b([IVX]{1,4})\b/i);
  return romanMatch ? romanMap[romanMatch[1].toUpperCase()] || null : null;
}

export function extractCgpaSummary(payload: unknown) {
  const grouped = payload as Record<string, any>;
  const section = grouped?.Academic?.["CGPA Summary"];
  const currentCgpa =
    String(
      section?.TableContent?.["Current CGPA"] || section?.meta?.cgpa || ""
    ).trim() || "";
  const semesterLabel =
    String(
      section?.TableContent?.Semester || section?.meta?.semesterLabel || ""
    ).trim() || "";
  const semesterNumber =
    Number(
      section?.meta?.semesterNumber || parseSemesterNumber(semesterLabel) || 0
    ) || null;

  return {
    currentCgpa,
    semesterLabel,
    semesterNumber,
  };
}

export default function ResultsCurrentPage({ blueprint }: Props) {
  const [data, setData] = useState<CurrentResultModel | null>(null);
  const [currentCourse, setCurrentCourse] =
    useState<CourseRegistrationModel | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumModel | null>(null);
  const [cgpaSummary, setCgpaSummary] = useState({
    currentCgpa: "",
    semesterLabel: "",
    semesterNumber: null as number | null,
  });
  const [internalMarks, setInternalMarks] = useState<InternalMarksModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const batchQuery = useQuery({
    queryKey: [...erpKeys.batch(blueprint.fetchKeys), refreshTrigger],
    queryFn: () => getErpBatch(blueprint.fetchKeys),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!batchQuery.error) return;
    setError(batchQuery.error instanceof Error ? batchQuery.error.message : "Failed to load results");
  }, [batchQuery.error]);

  useEffect(() => {
    const batch = batchQuery.data;
    if (!batch) return;

    try {
      const resultPayload = (batch["examination/current-semester-results"] as any)?.data;
      if (!resultPayload) {
        throw new Error("No data found for the current semester results.");
      }

      const resultModel = executePipeline("results-current", batch);
      if (!resultModel.isValid || !resultModel.data) {
        throw new Error("Validation failed for results data.");
      }

      const courseRegistrationPayload = (batch["academic/course-registration"] as any)?.data;
      const courseRegistrationModel = courseRegistrationPayload
        ? executePipeline("course-registration", courseRegistrationPayload)
        : { isValid: false, data: null };
      const nextCurrentCourse =
        courseRegistrationModel.isValid && courseRegistrationModel.data
          ? (courseRegistrationModel.data as CourseRegistrationModel)
          : null;

      const curriculumPayload = (batch["academic/student-wise-subjects"] as any)?.data;
      const curriculumModel = curriculumPayload
        ? executePipeline("curriculum", curriculumPayload)
        : { isValid: false, data: null };
      const nextCurriculum =
        curriculumModel.isValid && curriculumModel.data
          ? (curriculumModel.data as CurriculumModel)
          : null;

      const nextCgpaSummary = extractCgpaSummary(
        (batch["academic/cgpa-summary"] as any)?.data
      );

      setError(null);
      setData(resultModel.data as CurrentResultModel);
      setCurrentCourse(nextCurrentCourse);
      setCurriculum(nextCurriculum);
      setCgpaSummary(nextCgpaSummary);
      setInternalMarks((resultModel.data as CurrentResultModel).internalMarks || null);
    } catch (loadError: any) {
      setError(loadError.message || "Failed to load results");
    }
  }, [batchQuery.data, blueprint]);

  const loading = batchQuery.isPending;

  const internalMarksByCode = useMemo(() => {
    const entries = data?.internalMarks?.subjects || [];
    return new Map(
      entries.map((subject) => [
        subject.code.replace(/\s+/g, "").toUpperCase(),
        subject,
      ])
    );
  }, [data]);

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage || "Loading results..."}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      {error && (
        <InlineError
          message={error}
          onRetry={() => setRefreshTrigger((prev) => prev + 1)}
        />
      )}

      {data && (
        <>
          {/* Internal Marks Section */}
          {internalMarks && (
            <InternalMarksBundledSection model={internalMarks} />
          )}

          {/* Subject Results Section */}
          <section className="dashboard-card overflow-hidden p-0">
            <TableCardHeader title="Subject Results" />
            <div className={`px-3 pb-4 pt-3 md:p-0 ${FLUSH_TABLE_SHELL}`}>
              <SubjectResultsTable
                subjects={data.subjects}
                internalMarksByCode={internalMarksByCode}
              />
            </div>
          </section>

          {/* SGPA/CGPA Predictor Section */}
          <SectionCard title="SGPA / CGPA Predictor">
            <SgpaCgpaPredictor
              currentCourse={currentCourse}
              curriculum={curriculum}
              data={data}
              cgpaSummary={cgpaSummary}
            />
          </SectionCard>

          {/* Disclaimer */}
          {data.disclaimer && (
            <aside
              className="rounded-xl p-4"
              style={{
                background:
                  "color-mix(in srgb, var(--warning) 10%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
              }}
            >
              <p
                className="text-xs italic leading-relaxed"
                style={{ color: "var(--warning)" }}
              >
                {data.disclaimer}
              </p>
            </aside>
          )}
        </>
      )}
    </ErpPageShell>
  );
}
