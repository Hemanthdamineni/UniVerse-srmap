import { useEffect, useMemo, useState } from "react";
import type {
  CourseRegistrationModel,
  CurrentResultModel,
  CurriculumModel,
} from "../../../lib/erp/erpTransformers";

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

type PlannerSubject = {
  id: string;
  name: string;
  credits: number;
  grade: string;
};

interface SgpaCgpaPredictorProps {
  currentCourse: CourseRegistrationModel | null;
  curriculum: CurriculumModel | null;
  data: CurrentResultModel;
  cgpaSummary: {
    currentCgpa: string;
    semesterLabel: string;
    semesterNumber: number | null;
  };
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
    const source =
      semesterFiltered.length > 0 ? semesterFiltered : currentCourse.subjects;
    return source.map((subject, index) => ({
      id: `${subject.code}-${index}`,
      name: `${subject.code} - ${subject.description}`,
      credits: Number(subject.credit || 0) || 0,
      grade: "",
    }));
  }

  if (curriculum?.subjects?.length) {
    const matchingSemester = semesterNumber
      ? curriculum.subjects.filter(
          (subject) => parseSemesterNumber(subject.semester) === semesterNumber
        )
      : [];
    if (matchingSemester.length > 0) {
      return matchingSemester.map((subject, index) => ({
        id: `${subject.code}-${index}`,
        name: `${subject.code} - ${subject.description}`,
        credits: Number(subject.credit || 0) || 0,
        grade: "",
      }));
    }
  }

  if (data?.subjects?.length) {
    return data.subjects.map((subject, index) => ({
      id: `${subject.subjectCode}-${index}`,
      name: `${subject.subjectCode} - ${subject.subjectDescription}`,
      credits: Number(subject.credit || 0) || 0,
      grade: "",
    }));
  }

  return [];
}

export function SgpaCgpaPredictor({
  currentCourse,
  curriculum,
  data,
  cgpaSummary,
}: SgpaCgpaPredictorProps) {
  const [isManualMode, setIsManualMode] = useState(false);
  const [plannerSubjects, setPlannerSubjects] = useState<PlannerSubject[]>([]);

  const autoSubjects = useMemo(
    () =>
      buildPlannerSubjectsFromCurrentCourse(
        currentCourse,
        curriculum,
        data,
        cgpaSummary.semesterNumber
      ),
    [cgpaSummary.semesterNumber, currentCourse, curriculum, data]
  );

  useEffect(() => {
    if (isManualMode) return;
    setPlannerSubjects(autoSubjects);
  }, [autoSubjects, isManualMode]);

  const computedSgpa = useMemo(() => {
    const eligible = plannerSubjects.filter(
      (subject) => subject.grade && GRADE_POINTS[subject.grade] !== undefined
    );
    const totalCredits = eligible.reduce(
      (sum, subject) => sum + Number(subject.credits || 0),
      0
    );
    const totalPoints = eligible.reduce(
      (sum, subject) =>
        sum + GRADE_POINTS[subject.grade] * Number(subject.credits || 0),
      0
    );

    return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : "0.00";
  }, [plannerSubjects]);

  const projectedCgpa = useMemo(() => {
    const currentCgpaValue = Number(cgpaSummary.currentCgpa || 0);
    const sgpaValue = Number(computedSgpa || 0);
    const semesterNumber = Number(cgpaSummary.semesterNumber || 0);

    if (!sgpaValue) return cgpaSummary.currentCgpa || "0.00";
    if (!currentCgpaValue || semesterNumber <= 1)
      return sgpaValue.toFixed(2);
    return (
      ((currentCgpaValue * (semesterNumber - 1) + sgpaValue) / semesterNumber)
    ).toFixed(2);
  }, [cgpaSummary.currentCgpa, cgpaSummary.semesterNumber, computedSgpa]);

  const updatePlannerSubject = (
    id: string,
    field: "name" | "credits" | "grade",
    value: string | number
  ) => {
    setPlannerSubjects((current) =>
      current.map((subject) =>
        subject.id === id ? { ...subject, [field]: value } : subject
      )
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

  return (
    <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                {isManualMode ? "Manual Mode" : "Auto Mode"}
              </p>
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
          <div
            className="rounded-2xl p-4 text-white"
            style={{
              background: "var(--comp-accent)",
              border: "1px solid var(--comp-border)",
            }}
          >
            <p className="text-sm text-white/75">Projected SGPA</p>
            <p className="mt-2 text-3xl font-semibold">{computedSgpa}</p>
          </div>
          <div
            className="rounded-2xl p-4"
            style={{
              background: "var(--comp-surface)",
              border: "1px solid var(--comp-border)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--comp-text-secondary)" }}>
              Projected CGPA
            </p>
            <p
              className="mt-2 text-3xl font-semibold"
              style={{ color: "var(--comp-text-primary)" }}
            >
              {projectedCgpa}
            </p>
            {!cgpaSummary.currentCgpa ? (
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                Current CGPA could not be extracted, so the projection falls back
                to the SGPA estimate.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold" style={{ color: "var(--comp-text-primary)" }}>
              Planner Subjects
            </p>
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
              <div
                key={subject.id}
                className="grid gap-3 rounded-2xl p-3 md:grid-cols-[1fr_100px_140px_72px]"
                style={{
                  background: "var(--comp-surface)",
                  border: "1px solid var(--comp-border)",
                }}
              >
                {isManualMode ? (
                  <input
                    value={subject.name}
                    onChange={(event) =>
                      updatePlannerSubject(subject.id, "name", event.target.value)
                    }
                    placeholder="Subject name"
                    className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--comp-accent)]"
                  />
                ) : (
                  <div
                    className="flex items-center rounded-xl px-3 py-2 text-sm font-medium"
                    style={{
                      background:
                        "color-mix(in srgb, var(--comp-surface) 40%, transparent)",
                      color: "var(--comp-text-primary)",
                    }}
                  >
                    {subject.name}
                  </div>
                )}

                <input
                  type="number"
                  min={0}
                  value={subject.credits}
                  onChange={(event) =>
                    updatePlannerSubject(
                      subject.id,
                      "credits",
                      Number(event.target.value || 0)
                    )
                  }
                  className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--comp-accent)]"
                />

                <select
                  value={subject.grade}
                  onChange={(event) =>
                    updatePlannerSubject(subject.id, "grade", event.target.value)
                  }
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
                      setPlannerSubjects((current) =>
                        current.filter((item) => item.id !== subject.id)
                      )
                    }
                    className="rounded-xl border border-[color-mix(in_srgb,var(--error)_30%,transparent)] px-3 py-2 text-sm font-medium text-[var(--error)] transition hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
                  >
                    Remove
                  </button>
                ) : (
                  <div
                    className="flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
                    style={{
                      background:
                        "color-mix(in srgb, var(--comp-surface) 40%, transparent)",
                      color: "var(--comp-text-muted)",
                    }}
                  >
                    Auto
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">
              No subjects are loaded yet. Switch to manual mode to add your own
              planning set.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default SgpaCgpaPredictor;
