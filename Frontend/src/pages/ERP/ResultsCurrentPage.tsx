// ErpPageShell section-card; current results / planner structure unchanged.
import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
  executePipeline,
  type CourseRegistrationModel,
  type CurrentResultModel,
  type CurriculumModel,
  type InternalMarksModel,
  type InternalMarkSubject,
} from "../../lib/erpTransformers";
import { getErpBatch } from "../../lib/erpApi";
import type { PageBlueprint } from "../../config/erpBlueprints";

import { ErpPageShell, SectionCard } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/InlineError";

interface Props {
  blueprint: PageBlueprint;
}

type PlannerSubject = {
  id: string;
  name: string;
  credits: number;
  grade: string;
};

const GRADE_POINTS: Record<string, number> = {
  O: 10,
  "A+": 9,
  A: 8,
  "B+": 7,
  B: 6,
  C: 5,
  P: 4,
  D: 4,
  F: 0,
  RA: 0,
  AB: 0,
};

const GRADE_OPTIONS = ["", "O", "A+", "A", "B+", "B", "C", "P", "D", "F", "RA", "AB"];

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

function buildPlannerSubjects(data: CurrentResultModel | null, curriculum: CurriculumModel | null): PlannerSubject[] {
  if (data?.subjects?.length) {
    return data.subjects.map((subject, index) => ({
      id: `${subject.subjectCode}-${index}`,
      name: `${subject.subjectCode} - ${subject.subjectDescription}`,
      credits: Number(subject.credit || 0) || 0,
      grade: "", // start empty for prediction
    }));
  }

  if (curriculum?.subjects?.length) {
    return curriculum.subjects.map((subject, index) => ({
      id: `${subject.code}-${index}`,
      name: `${subject.code} - ${subject.description}`,
      credits: Number(subject.credit || 0) || 0,
      grade: "",
    }));
  }

  return [];
}

function buildPlannerSubjectsFromCurrentCourse(
  currentCourse: CourseRegistrationModel | null,
  curriculum: CurriculumModel | null,
  data: CurrentResultModel | null,
  semesterNumber: number | null
): PlannerSubject[] {
  if (currentCourse?.subjects?.length) {
    const semesterFiltered =
      semesterNumber && semesterNumber > 0
        ? currentCourse.subjects.filter(
            (subject) => parseSemesterNumber(subject.semester) === semesterNumber
          )
        : currentCourse.subjects;
    const source = semesterFiltered.length > 0 ? semesterFiltered : currentCourse.subjects;
    return source.map((subject, index) => ({
      id: `${subject.code}-${index}`,
      name: `${subject.code} - ${subject.description}`,
      credits: Number(subject.credit || 0) || 0,
      grade: "",
    }));
  }

  if (curriculum?.subjects?.length) {
    const matchingSemester = semesterNumber
      ? curriculum.subjects.filter((subject) => parseSemesterNumber(subject.semester) === semesterNumber)
      : [];
    if (matchingSemester.length > 0) {
      return buildPlannerSubjects(data, { subjects: matchingSemester });
    }
  }

  return buildPlannerSubjects(data, curriculum);
}

function extractCgpaSummary(payload: unknown) {
  const grouped = payload as Record<string, any>;
  const section = grouped?.Academic?.["CGPA Summary"];
  const currentCgpa =
    String(
      section?.TableContent?.["Current CGPA"] ||
        section?.meta?.cgpa ||
        ""
    ).trim() || "";
  const semesterLabel =
    String(
      section?.TableContent?.Semester ||
        section?.meta?.semesterLabel ||
        ""
    ).trim() || "";
  const semesterNumber = Number(section?.meta?.semesterNumber || parseSemesterNumber(semesterLabel) || 0) || null;

  return {
    currentCgpa,
    semesterLabel,
    semesterNumber,
  };
}

export default function ResultsCurrentPage({ blueprint }: Props) {
  const [data, setData] = useState<CurrentResultModel | null>(null);
  const [currentCourse, setCurrentCourse] = useState<CourseRegistrationModel | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumModel | null>(null);
  const [cgpaSummary, setCgpaSummary] = useState<{
    currentCgpa: string;
    semesterLabel: string;
    semesterNumber: number | null;
  }>({
    currentCgpa: "",
    semesterLabel: "",
    semesterNumber: null,
  });
  const [plannerSubjects, setPlannerSubjects] = useState<PlannerSubject[]>([]);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [isManualMode, setIsManualMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const batch = await getErpBatch(blueprint.fetchKeys);
        if (!active) return;

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
          curriculumModel.isValid && curriculumModel.data ? (curriculumModel.data as CurriculumModel) : null;

        const nextCgpaSummary = extractCgpaSummary((batch["academic/cgpa-summary"] as any)?.data);

        setData(resultModel.data as CurrentResultModel);
        setCurrentCourse(nextCurrentCourse);
        setCurriculum(nextCurriculum);
        setCgpaSummary(nextCgpaSummary);
      } catch (loadError: any) {
        if (active) setError(loadError.message || "Failed to load results");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [blueprint, refreshTrigger]);

  const autoSubjects = useMemo(
    () => buildPlannerSubjectsFromCurrentCourse(currentCourse, curriculum, data, cgpaSummary.semesterNumber),
    [cgpaSummary.semesterNumber, currentCourse, curriculum, data]
  );

  useEffect(() => {
    if (isManualMode) return;
    setPlannerSubjects(autoSubjects);
  }, [autoSubjects, isManualMode]);

  const computedSgpa = useMemo(() => {
    const eligible = plannerSubjects.filter((subject) => subject.grade && GRADE_POINTS[subject.grade] !== undefined);
    const totalCredits = eligible.reduce((sum, subject) => sum + Number(subject.credits || 0), 0);
    const totalPoints = eligible.reduce(
      (sum, subject) => sum + GRADE_POINTS[subject.grade] * Number(subject.credits || 0),
      0
    );

    return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : "0.00";
  }, [plannerSubjects]);

  const projectedCgpa = useMemo(() => {
    const currentCgpaValue = Number(cgpaSummary.currentCgpa || 0);
    const sgpaValue = Number(computedSgpa || 0);
    const semesterNumber = Number(cgpaSummary.semesterNumber || 0);

    if (!sgpaValue) return cgpaSummary.currentCgpa || "0.00";
    if (!currentCgpaValue || semesterNumber <= 1) return sgpaValue.toFixed(2);
    return (((currentCgpaValue * (semesterNumber - 1)) + sgpaValue) / semesterNumber).toFixed(2);
  }, [cgpaSummary.currentCgpa, cgpaSummary.semesterNumber, computedSgpa]);

  const updatePlannerSubject = (id: string, field: "name" | "credits" | "grade", value: string | number) => {
    setPlannerSubjects((current) =>
      current.map((subject) => (subject.id === id ? { ...subject, [field]: value } : subject))
    );
  };

  const addManualSubject = () => {
    setPlannerSubjects((current) => [
      ...current,
      {
        id: `manual-${Date.now()}`,
        name: "",
        credits: 3,
        grade: "",
      },
    ]);
  };

  const resetPlanner = () => {
    setPlannerSubjects(isManualMode ? [] : autoSubjects);
  };

  const internalMarksByCode = useMemo(() => {
    const entries = data?.internalMarks?.subjects || [];
    return new Map(entries.map((subject) => [subject.code.replace(/\s+/g, "").toUpperCase(), subject]));
  }, [data]);

  const toggleSubjectExpansion = (subjectCode: string) => {
    setExpandedSubjects((current) => {
      const next = new Set(current);
      if (next.has(subjectCode)) {
        next.delete(subjectCode);
      } else {
        next.add(subjectCode);
      }
      return next;
    });
  };

  return (
    <ErpPageShell
      title={blueprint.heading}
      source="Live ERP"
      isLoading={loading}
      loadingMessage={blueprint.loadingMessage || "Loading results..."}
      onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
    >
      {error && (
        <InlineError message={error} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
      )}

      {data && (
        <>
          {data.title && (
            <p data-page-contrast="true" className="page-contrast-muted mb-4 text-sm font-medium">
              {data.title}
            </p>
          )}

          {/* <div className="grid gap-4 lg:grid-cols-3">
            <div className="dashboard-card p-5">
              <p className="text-sm text-[var(--text-secondary)]">Current SGPA</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">{data.sgpa || "Not available"}</p>
            </div>
            <div className="dashboard-card p-5">
              <p className="text-sm text-[var(--text-secondary)]">Current CGPA</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">
                {cgpaSummary.currentCgpa || "Unavailable"}
              </p>
            </div>
            <div className="dashboard-card p-5">
              <p className="text-sm text-[var(--text-secondary)]">Semester</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--comp-text-primary)]">
                {cgpaSummary.semesterLabel || (cgpaSummary.semesterNumber ? `Semester ${cgpaSummary.semesterNumber}` : "Unavailable")}
              </p>
            </div>
          </div> */}

          <section className="dashboard-card p-0">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h3 className="font-semibold" style={{ color: 'var(--comp-text-primary)' }}>Subject Results</h3>
            </div>
            <div className="px-5 pb-5">
              <div className="erp-table-shell hidden overflow-auto md:block">
                <table className="erp-table" aria-label="Current semester subject results">
                  <thead className="erp-table-head">
                    <tr className="erp-table-row">
                      <th className="erp-table-head-cell label-text sticky top-0 z-[1] w-10 bg-[var(--comp-accent)]"> </th>
                      <th className="erp-table-head-cell label-text sticky top-0 z-[1] bg-[var(--comp-accent)]">Code</th>
                      <th className="erp-table-head-cell label-text sticky top-0 z-[1] bg-[var(--comp-accent)]">Description</th>
                      <th className="erp-table-head-cell label-text sticky top-0 z-[1] bg-[var(--comp-accent)] text-center">Semester</th>
                      <th className="erp-table-head-cell label-text sticky top-0 z-[1] bg-[var(--comp-accent)] text-center">Credits</th>
                      <th className="erp-table-head-cell label-text sticky top-0 z-[1] bg-[var(--comp-accent)] text-center">Grade</th>
                      <th className="erp-table-head-cell label-text sticky top-0 z-[1] bg-[var(--comp-accent)] text-center">Result</th>
                    </tr>
                  </thead>
                  <tbody className="erp-table-body">
                    {data.subjects.length === 0 ? (
                      <tr className="erp-table-row">
                        <td colSpan={7} className="erp-table-cell py-8 text-center text-sm italic text-[var(--comp-text-muted)]">
                          No subject results found.
                        </td>
                      </tr>
                    ) : (
                      data.subjects.map((subject, index) => {
                        const subjectKey = `${subject.subjectCode}-${index}`;
                        const normalizedCode = subject.subjectCode.replace(/\s+/g, "").toUpperCase();
                        const internalMark = internalMarksByCode.get(normalizedCode);
                        const isExpanded = expandedSubjects.has(subjectKey);

                        return (
                          <Fragment key={subjectKey}>
                            <tr className="erp-table-row bg-[color:var(--comp-surface)] hover:bg-[color:var(--comp-surface-hover)]">
                              <td className="erp-table-cell">
                                {internalMark ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleSubjectExpansion(subjectKey)}
                                    aria-label={`${isExpanded ? "Hide" : "Show"} internal marks for ${subject.subjectCode}`}
                                    aria-expanded={isExpanded}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--comp-text-secondary)] transition hover:bg-[var(--comp-surface-hover)] hover:text-[var(--comp-text-primary)] focus:outline-none"
                                  >
                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </button>
                                ) : null}
                              </td>
                              <td className="erp-table-cell font-semibold">{subject.subjectCode}</td>
                              <td className="erp-table-cell">{subject.subjectDescription}</td>
                              <td className="erp-table-cell text-center">{subject.semester}</td>
                              <td className="erp-table-cell text-center font-medium text-[var(--comp-text-secondary)]">{subject.credit}</td>
                              <td className="erp-table-cell text-center">
                                <span className="inline-flex min-w-[2rem] items-center justify-center rounded bg-[var(--comp-surface-hover)] px-2 py-1 font-bold text-[var(--comp-text-primary)]">
                                  {subject.grade}
                                </span>
                              </td>
                              <td className="erp-table-cell text-center">
                                <span className={`erp-status-pill ${subject.result.toLowerCase() === "pass" ? "erp-status-pill-success" : "erp-status-pill-error"}`}>
                                  {subject.result}
                                </span>
                              </td>
                            </tr>
                            {isExpanded && internalMark ? (
                              <tr className="erp-table-row bg-[color:var(--comp-surface)]">
                                <td colSpan={7} className="erp-table-cell">
                                  <div className="grid gap-3 rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface-hover)] p-4 sm:grid-cols-4">
                                    <div>
                                      <p className="label-text">Internal Marks</p>
                                      <p className="mt-1 text-lg font-semibold text-[var(--comp-text-primary)]">
                                        {internalMark.marksObtained.toFixed(2)} / {internalMark.maxMarks.toFixed(2)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="label-text">Percentage</p>
                                      <p className="mt-1 text-lg font-semibold text-[var(--comp-text-primary)]">
                                        {internalMark.percentage.toFixed(2)}%
                                      </p>
                                    </div>
                                    <div>
                                      <p className="label-text">Signal</p>
                                      <p className="mt-1 text-sm font-semibold capitalize text-[var(--comp-text-primary)]">
                                        {internalMark.status.replace("-", " ")}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="label-text">Source Row</p>
                                      <p className="mt-1 text-sm font-semibold text-[var(--comp-text-primary)]">
                                        {internalMark.detailTableIndex}
                                      </p>
                                    </div>
                                    {internalMark.assessments && internalMark.assessments.length > 0 ? (
                                      <div className="sm:col-span-4">
                                        <AssessmentBreakdownTable subject={internalMark} />
                                      </div>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {data.subjects.length === 0 ? (
                  <p className="rounded-xl border border-[var(--comp-border)] p-4 text-center text-sm italic text-[var(--comp-text-muted)]">
                    No subject results found.
                  </p>
                ) : (
                  data.subjects.map((subject, index) => {
                    const subjectKey = `${subject.subjectCode}-${index}`;
                    const internalMark = internalMarksByCode.get(subject.subjectCode.replace(/\s+/g, "").toUpperCase());
                    const isExpanded = expandedSubjects.has(subjectKey);

                    return (
                      <div key={subjectKey} className="rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[var(--comp-text-primary)]">{subject.subjectCode}</p>
                            <p className="mt-1 text-sm text-[var(--comp-text-secondary)]">{subject.subjectDescription}</p>
                          </div>
                          {internalMark ? (
                            <button
                              type="button"
                              onClick={() => toggleSubjectExpansion(subjectKey)}
                              aria-label={`${isExpanded ? "Hide" : "Show"} internal marks for ${subject.subjectCode}`}
                              aria-expanded={isExpanded}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--comp-text-secondary)] transition hover:bg-[var(--comp-surface-hover)] hover:text-[var(--comp-text-primary)] focus:outline-none"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <span className="text-[var(--comp-text-secondary)]">Semester: {subject.semester}</span>
                          <span className="text-[var(--comp-text-secondary)]">Credits: {subject.credit}</span>
                          <span className="font-semibold text-[var(--comp-text-primary)]">Grade: {subject.grade}</span>
                          <span className="font-semibold text-[var(--comp-text-primary)]">Result: {subject.result}</span>
                        </div>
                        {isExpanded && internalMark ? (
                          <div className="mt-4 rounded-xl bg-[var(--comp-surface-hover)] p-3 text-sm">
                            <p className="font-semibold text-[var(--comp-text-primary)]">
                              {internalMark.marksObtained.toFixed(2)} / {internalMark.maxMarks.toFixed(2)}
                            </p>
                            <p className="mt-1 text-[var(--comp-text-secondary)]">
                              {internalMark.percentage.toFixed(2)}%, {internalMark.status.replace("-", " ")}
                            </p>
                            {internalMark.assessments && internalMark.assessments.length > 0 ? (
                              <div className="mt-3">
                                <AssessmentBreakdownTable subject={internalMark} compact />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {data.internalMarks ? <InternalMarksBundledSection model={data.internalMarks} /> : null}

          <SectionCard title="SGPA / CGPA Predictor">
            <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--comp-text-primary)' }}>{isManualMode ? "Manual Mode" : "Auto Mode"}</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {isManualMode
                            ? "Add custom subjects and credits for planning."
                            : "Subjects are prefilled from current course registration, then fall back to results or curriculum."}
                        </p>
                      </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualMode((current) => {
                          const nextManualMode = !current;
                          setPlannerSubjects(nextManualMode ? [] : autoSubjects);
                          return nextManualMode;
                        });
                      }}
                      className="comp-btn-secondary min-h-0 rounded-full px-4 py-2 text-sm font-medium"
                    >
                      {isManualMode ? "Switch To Auto" : "Switch To Manual"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-2xl p-4 text-white" style={{ background: 'var(--comp-accent)', border: '1px solid var(--comp-border)' }}>
                    <p className="text-sm text-white/75">Projected SGPA</p>
                    <p className="mt-2 text-3xl font-semibold">{computedSgpa}</p>
                  </div>
                  <div className="rounded-2xl p-4" style={{ background: 'var(--comp-surface)', border: '1px solid var(--comp-border)' }}>
                    <p className="text-sm" style={{ color: 'var(--comp-text-secondary)' }}>Projected CGPA</p>
                    <p className="mt-2 text-3xl font-semibold" style={{ color: 'var(--comp-text-primary)' }}>{projectedCgpa}</p>
                    {!cgpaSummary.currentCgpa ? (
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">
                        Current CGPA could not be extracted, so the projection falls back to the SGPA estimate.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--comp-text-primary)' }}>Planner Subjects</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Update grades and credits to see the projection refresh immediately.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isManualMode ? (
                      <button
                        type="button"
                        onClick={addManualSubject}
                        className="comp-btn-secondary min-h-0 rounded-full px-4 py-2 text-sm font-medium"
                      >
                        Add Subject
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={resetPlanner}
                      className="comp-btn-secondary min-h-0 rounded-full px-4 py-2 text-sm font-medium"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {plannerSubjects.length ? (
                    plannerSubjects.map((subject) => (
                      <div key={subject.id} className="grid gap-3 rounded-2xl p-3 md:grid-cols-[1fr_100px_140px_72px]" style={{ background: 'var(--comp-surface)', border: '1px solid var(--comp-border)' }}>
                        {isManualMode ? (
                          <input
                            value={subject.name}
                            onChange={(event) => updatePlannerSubject(subject.id, "name", event.target.value)}
                            placeholder="Subject name"
                            className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--comp-accent)]"
                          />
                        ) : (
                          <div className="flex items-center rounded-xl px-3 py-2 text-sm font-medium" style={{ background: 'color-mix(in srgb, var(--comp-surface) 40%, transparent)', color: 'var(--comp-text-primary)' }}>
                            {subject.name}
                          </div>
                        )}

                        <input
                          type="number"
                          min={0}
                          value={subject.credits}
                          onChange={(event) =>
                            updatePlannerSubject(subject.id, "credits", Number(event.target.value || 0))
                          }
                          className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--comp-accent)]"
                        />

                        <select
                          value={subject.grade}
                          onChange={(event) => updatePlannerSubject(subject.id, "grade", event.target.value)}
                          className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--comp-accent)]"
                        >
                          {GRADE_OPTIONS.map((grade) => (
                            <option key={grade || "empty"} value={grade}>
                              {grade || "Select Grade"}
                            </option>
                          ))}
                        </select>

                        {isManualMode ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPlannerSubjects((current) => current.filter((item) => item.id !== subject.id))
                            }
                            className="rounded-xl border border-[color-mix(in_srgb,var(--error)_30%,transparent)] px-3 py-2 text-sm font-medium text-[var(--error)] transition hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
                          >
                            Remove
                          </button>
                        ) : (
                          <div className="flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ background: 'color-mix(in srgb, var(--comp-surface) 40%, transparent)', color: 'var(--comp-text-muted)' }}>
                            Auto
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      No subjects are loaded yet. Switch to manual mode to add your own planning set.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          {data.disclaimer && (
            <aside className="rounded-xl p-4" style={{ background: 'color-mix(in srgb, var(--warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)' }}>
              <p className="text-xs italic leading-relaxed" style={{ color: 'var(--warning)' }}>{data.disclaimer}</p>
            </aside>
          )}
        </>
      )}
    </ErpPageShell>
  );
}

function AssessmentBreakdownTable({
  subject,
  compact = false,
}: {
  subject: InternalMarkSubject;
  compact?: boolean;
}) {
  const assessments = subject.assessments || [];
  if (assessments.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--comp-border)]">
      <table className="w-full text-sm" aria-label={`${subject.code} internal assessment breakdown`}>
        <thead className="bg-[var(--comp-surface)]">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-[var(--comp-text-secondary)]">Assessment</th>
            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-[var(--comp-text-secondary)]">Conducted</th>
            <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-[var(--comp-text-secondary)]">Converted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--comp-border)]">
          {assessments.map((assessment, index) => (
            <tr key={`${subject.code}-${assessment.name}-${index}`}>
              <td className="px-3 py-2.5 text-[var(--comp-text-primary)]">{assessment.name}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-[var(--comp-text-secondary)]">
                {assessment.conducted || "-"}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-[var(--comp-text-secondary)]">
                {assessment.converted || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!compact ? (
        <div className="border-t border-[var(--comp-border)] bg-[color-mix(in_srgb,var(--comp-surface)_60%,transparent)] px-3 py-2 text-right text-xs font-semibold text-[var(--comp-text-secondary)]">
          Total: {subject.marksObtained.toFixed(2)} / {subject.maxMarks.toFixed(0)}
        </div>
      ) : null}
    </div>
  );
}

function InternalMarksBundledSection({ model }: { model: InternalMarksModel }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <section className="dashboard-card p-0">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-[var(--comp-text-primary)]">Internal Mark Details</h2>
          <span className="rounded-full bg-[var(--comp-surface-hover)] px-3 py-1 text-xs font-semibold text-[var(--comp-text-secondary)]">
            {model.averagePercentage.toFixed(2)}% average
          </span>
        </div>
      </div>

      {model.subjects.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm italic text-[var(--comp-text-muted)]">
          No internal mark details found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
          {model.subjects.map((subject) => {
            const isOpen = expanded.has(subject.code);
            const hasAssessments = subject.assessments && subject.assessments.length > 0;
            const pct = subject.maxMarks > 0 ? (subject.marksObtained / subject.maxMarks) * 100 : 0;
            const pctColor = pct >= 75 ? "var(--success)" : pct >= 50 ? "var(--warning)" : "var(--error)";

            return (
              <div
                key={subject.code}
                className="flex flex-col overflow-hidden rounded-xl border border-[var(--comp-border)] bg-[var(--background)] transition-shadow hover:shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => hasAssessments && toggle(subject.code)}
                  aria-expanded={hasAssessments ? isOpen : undefined}
                  aria-label={hasAssessments ? `${isOpen ? "Collapse" : "Expand"} ${subject.code}` : undefined}
                  className={`w-full px-5 py-4 text-left transition-colors ${hasAssessments ? "cursor-pointer hover:bg-[var(--comp-surface-hover)]" : "cursor-default"}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        {/* Teal code badge */}
                        <span className="shrink-0 rounded-md bg-[var(--comp-accent-light)] px-2.5 py-1 text-xs font-bold tracking-wide text-[var(--comp-accent)] tabular-nums">
                          {subject.code}
                        </span>
                        <span className="truncate text-sm font-medium text-[var(--comp-text-primary)]">
                          {subject.description}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-5">
                      {/* Marks + progress bar */}
                      <div className="text-right">
                        <p className="text-sm tabular-nums">
                          <span className="font-bold text-[var(--comp-accent)]">
                            {subject.marksObtained.toFixed(2)}
                          </span>
                          <span className="mx-0.5 text-[var(--comp-text-muted)]">/</span>
                          <span className="text-xs text-[var(--comp-text-muted)]">
                            {subject.maxMarks.toFixed(0)}
                          </span>
                        </p>
                        {/* Mini progress bar */}
                        <div className="mt-1.5 h-1 w-16 overflow-hidden rounded-full bg-[var(--comp-surface-hover)]">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              background: pctColor,
                            }}
                          />
                        </div>
                      </div>

                      {/* Percentage pill */}
                      <span
                        className={`erp-status-pill tabular-nums text-xs font-bold ${
                          pct >= 75
                            ? "erp-status-pill-success"
                            : pct >= 50
                              ? "erp-status-pill-warning"
                              : "erp-status-pill-error"
                        }`}
                      >
                        {pct.toFixed(1)}%
                      </span>

                      {hasAssessments ? (
                        <ChevronDown
                          className="h-4 w-4 shrink-0 text-[var(--comp-text-muted)] transition-transform duration-200"
                          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                        />
                      ) : (
                        <div className="w-4" />
                      )}
                    </div>
                  </div>
                </button>

                {isOpen && hasAssessments ? (
                  <div className="border-t border-[var(--comp-border)] bg-[var(--comp-surface-hover)] px-5 py-4">
                    <AssessmentBreakdownTable subject={subject} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
