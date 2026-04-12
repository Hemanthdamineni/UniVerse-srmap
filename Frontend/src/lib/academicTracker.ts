import { getErpBatch } from "./erpApi";
import {
  executePipeline,
  normalizeRawValue,
  type AttendanceModel,
  type CourseRegistrationModel,
  type CurrentResultModel,
  type InternalMarksModel,
} from "./erpTransformers";

const TOTAL_CREDITS_REQUIRED = 160;
const MONTHS = "JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC";

type HistoricalResultRecord = {
  semester: number;
  monthYear: string;
  subjectCode: string;
  subjectDescription: string;
  credit: number;
  grade: string;
  gradePoint: number;
  result: string;
  attempt: number;
};

export type SemesterPerformance = {
  semester: number;
  credits: number;
  sgpa: string;
  status: "Completed" | "In Progress";
};

export type SubjectSignal = {
  code: string;
  description: string;
  value: string;
};

export type AcademicRecommendation = {
  title: string;
  description: string;
  type: "improvement" | "positive" | "suggestion" | "warning";
};

export type AcademicTrackerSnapshot = {
  currentCgpa: string;
  currentSemesterNumber: number | null;
  currentSemesterLabel: string;
  completedCredits: number;
  totalCreditsRequired: number;
  progressPercent: number;
  semesterPerformance: SemesterPerformance[];
  overallAttendancePct: number;
  absenceCount: number;
  subjectsAtRisk: number;
  currentCourseCount: number;
  currentCourseCredits: number;
  internalAveragePct: number;
  strongestAttendanceSubject: SubjectSignal | null;
  weakestAttendanceSubject: SubjectSignal | null;
  strongestInternalSubject: SubjectSignal | null;
  weakestInternalSubject: SubjectSignal | null;
  gradeDistribution: Array<{ grade: string; count: number }>;
  recommendations: AcademicRecommendation[];
};

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

function extractCgpaSummary(payload: unknown) {
  const grouped = payload as Record<string, any>;
  const section = grouped?.Academic?.["CGPA Summary"];
  const currentCgpa =
    String(section?.TableContent?.["Current CGPA"] || section?.meta?.cgpa || "").trim() || "0.00";
  const semesterLabel = String(section?.TableContent?.Semester || section?.meta?.semesterLabel || "").trim() || "";
  const semesterNumber = Number(section?.meta?.semesterNumber || parseSemesterNumber(semesterLabel) || 0) || null;

  return {
    currentCgpa,
    semesterLabel,
    semesterNumber,
  };
}

function parseHistoricalExamRecords(rawData: unknown): HistoricalResultRecord[] {
  const section =
    rawData && typeof rawData === "object"
      ? ((rawData as Record<string, unknown>).Examination as Record<string, unknown> | undefined)?.["Exam Mark Details"]
      : null;
  const text = normalizeRawValue((section as Record<string, unknown> | null)?.text || "");
  if (!text) return [];

  const records: HistoricalResultRecord[] = [];
  const pattern = new RegExp(
    `(\\d+)\\s+(${MONTHS})\\s+(\\d{4})\\s+([A-Z]{2,}\\s*\\d{3}[A-Z]?)\\s+(.+?)\\s+(\\d+|-)\\s+(O|A\\+|A|B\\+|B|C|D|P|F|RA|AB|-)\\s+(\\d+\\.\\d{2}|-)\\s+(PASS|FAIL|ABSENT|RA|WH)\\s+(\\d+)`,
    "gi"
  );

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    records.push({
      semester: Number(match[1] || 0),
      monthYear: `${match[2]} ${match[3]}`,
      subjectCode: match[4]?.trim() || "",
      subjectDescription: match[5]?.trim() || "",
      credit: match[6] === "-" ? 0 : Number(match[6] || 0),
      grade: match[7]?.trim() || "",
      gradePoint: match[8] === "-" ? 0 : Number(match[8] || 0),
      result: match[9]?.trim() || "",
      attempt: Number(match[10] || 1),
    });
  }

  const deduped = new Map<string, HistoricalResultRecord>();
  for (const record of records) {
    const key = `${record.semester}|${record.subjectCode}`;
    const existing = deduped.get(key);
    if (!existing || existing.attempt < record.attempt) {
      deduped.set(key, record);
    }
  }

  return Array.from(deduped.values()).sort((left, right) => {
    if (left.semester !== right.semester) return left.semester - right.semester;
    return left.subjectCode.localeCompare(right.subjectCode);
  });
}

function summarizeSemesterPerformance(
  records: HistoricalResultRecord[],
  currentCourse: CourseRegistrationModel | null,
  currentSemesterNumber: number | null
) {
  const grouped = new Map<number, { credits: number; points: number }>();

  for (const record of records) {
    if (!record.semester) continue;
    if (!grouped.has(record.semester)) {
      grouped.set(record.semester, { credits: 0, points: 0 });
    }
    const bucket = grouped.get(record.semester)!;
    if (record.credit > 0 && record.gradePoint > 0) {
      bucket.credits += record.credit;
      bucket.points += record.gradePoint * record.credit;
    }
  }

  const performance: SemesterPerformance[] = Array.from(grouped.entries())
    .map(([semester, values]) => ({
      semester,
      credits: values.credits,
      sgpa: values.credits > 0 ? (values.points / values.credits).toFixed(2) : "TBD",
      status: "Completed" as const,
    }))
    .sort((left, right) => left.semester - right.semester);

  const currentCourseSemester =
    currentSemesterNumber ||
    currentCourse?.subjects
      .map((subject) => parseSemesterNumber(subject.semester))
      .filter((value): value is number => Number.isInteger(value))
      .sort((left, right) => right - left)[0] ||
    null;

  if (
    currentCourse?.subjects?.length &&
    currentCourseSemester &&
    !performance.some((item) => item.semester === currentCourseSemester)
  ) {
    performance.push({
      semester: currentCourseSemester,
      credits: currentCourse.subjects.reduce((sum, subject) => sum + (Number(subject.credit || 0) || 0), 0),
      sgpa: "TBD",
      status: "In Progress" as const,
    });
  }

  return performance.sort((left, right) => left.semester - right.semester);
}

function summarizeGradeDistribution(records: HistoricalResultRecord[]) {
  const buckets = new Map<string, number>();
  for (const record of records) {
    const grade = record.grade || "-";
    buckets.set(grade, (buckets.get(grade) || 0) + 1);
  }
  return Array.from(buckets.entries())
    .map(([grade, count]) => ({ grade, count }))
    .sort((left, right) => right.count - left.count || left.grade.localeCompare(right.grade));
}

function toAttendanceSignal(
  model: AttendanceModel | null,
  direction: "strongest" | "weakest"
): SubjectSignal | null {
  const records = model?.records || [];
  if (!records.length) return null;
  const sorted = [...records].sort((left, right) =>
    direction === "strongest" ? right.attendancePct - left.attendancePct : left.attendancePct - right.attendancePct
  );
  const target = sorted[0];
  if (!target) return null;
  return {
    code: target.subjectCode,
    description: target.subjectDescription,
    value: `${target.attendancePct.toFixed(2)}% attendance`,
  };
}

function toInternalSignal(
  model: InternalMarksModel | null,
  direction: "strongest" | "weakest"
): SubjectSignal | null {
  const subjects = model?.subjects || [];
  if (!subjects.length) return null;
  const sorted = [...subjects].sort((left, right) =>
    direction === "strongest" ? right.percentage - left.percentage : left.percentage - right.percentage
  );
  const target = sorted[0];
  if (!target) return null;
  return {
    code: target.code,
    description: target.description,
    value: `${target.percentage.toFixed(0)}% internal score`,
  };
}

function buildRecommendations(snapshot: {
  overallAttendancePct: number;
  currentCourseCount: number;
  subjectsAtRisk: number;
  semesterPerformance: SemesterPerformance[];
  weakestAttendanceSubject: SubjectSignal | null;
  weakestInternalSubject: SubjectSignal | null;
}) {
  const recommendations: AcademicRecommendation[] = [];

  if (snapshot.subjectsAtRisk > 0 && snapshot.weakestAttendanceSubject) {
    recommendations.push({
      title: "Attendance Needs Attention",
      description: `${snapshot.subjectsAtRisk} subject(s) are below 75%. Start with ${snapshot.weakestAttendanceSubject.code} to recover the fastest.`,
      type: "warning",
    });
  }

  if (snapshot.weakestInternalSubject) {
    recommendations.push({
      title: "Strengthen Internal Preparation",
      description: `${snapshot.weakestInternalSubject.code} is your weakest current internal-mark signal. Prioritize that course before the next evaluation window.`,
      type: "improvement",
    });
  }

  if (snapshot.currentCourseCount > 0) {
    recommendations.push({
      title: "Use Current Course Load for Planning",
      description: `Your live plan currently tracks ${snapshot.currentCourseCount} enrolled subjects, so projections now follow the active semester instead of old result rows.`,
      type: "suggestion",
    });
  }

  const completedSemesters = snapshot.semesterPerformance.filter((item) => item.status === "Completed" && item.sgpa !== "TBD");
  if (completedSemesters.length >= 2) {
    const latest = Number(completedSemesters[completedSemesters.length - 1].sgpa || 0);
    const previous = Number(completedSemesters[completedSemesters.length - 2].sgpa || 0);
    if (latest >= previous) {
      recommendations.push({
        title: "Momentum Is Positive",
        description: `Your latest completed semester stayed on or above the previous SGPA trend. Keep the same revision rhythm going into the current term.`,
        type: "positive",
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: "Data Is Flowing Normally",
      description: "Live ERP data loaded successfully. Keep checking attendance and internal marks to catch slippage early.",
      type: "positive",
    });
  }

  return recommendations.slice(0, 4);
}

export async function loadAcademicTrackerSnapshot(): Promise<AcademicTrackerSnapshot> {
  const batch = await getErpBatch([
    "examination/exam-mark-details",
    "examination/current-semester-results",
    "academic/attendance-details",
    "academic/cgpa-summary",
    "examination/internal-mark-details",
    "academic/course-registration",
  ]);

  const cgpaSummary = extractCgpaSummary((batch["academic/cgpa-summary"] as any)?.data);

  const attendancePipeline = (batch["academic/attendance-details"] as any)?.data
    ? executePipeline("attendance", (batch["academic/attendance-details"] as any)?.data)
    : null;
  const attendanceModel =
    attendancePipeline?.isValid && attendancePipeline.data ? (attendancePipeline.data as AttendanceModel) : null;

  const internalPipeline = (batch["examination/internal-mark-details"] as any)?.data
    ? executePipeline("internal-marks", (batch["examination/internal-mark-details"] as any)?.data)
    : null;
  const internalModel =
    internalPipeline?.isValid && internalPipeline.data ? (internalPipeline.data as InternalMarksModel) : null;

  const currentResultPipeline = (batch["examination/current-semester-results"] as any)?.data
    ? executePipeline("results-current", (batch["examination/current-semester-results"] as any)?.data)
    : null;
  const currentResults =
    currentResultPipeline?.isValid && currentResultPipeline.data
      ? (currentResultPipeline.data as CurrentResultModel)
      : null;

  const currentCoursePipeline = (batch["academic/course-registration"] as any)?.data
    ? executePipeline("course-registration", (batch["academic/course-registration"] as any)?.data)
    : null;
  const currentCourse =
    currentCoursePipeline?.isValid && currentCoursePipeline.data
      ? (currentCoursePipeline.data as CourseRegistrationModel)
      : null;

  const historicalRecords = parseHistoricalExamRecords((batch["examination/exam-mark-details"] as any)?.data);
  const semesterPerformance = summarizeSemesterPerformance(
    historicalRecords,
    currentCourse,
    cgpaSummary.semesterNumber
  );

  const completedCredits = historicalRecords.reduce((sum, record) => sum + (record.credit > 0 ? record.credit : 0), 0);
  const overallAttendancePct =
    attendanceModel?.records.length
      ? attendanceModel.records.reduce((sum, record) => sum + record.attendancePct, 0) / attendanceModel.records.length
      : 0;
  const absenceCount =
    attendanceModel?.records.reduce(
      (sum, record) => sum + Math.max(0, record.attendanceEntered - record.present - record.odMlTaken),
      0
    ) || 0;
  const subjectsAtRisk = attendanceModel?.records.filter((record) => record.attendancePct < 75).length || 0;
  const currentCourseCount = currentCourse?.subjects.length || 0;
  const currentCourseCredits =
    currentCourse?.subjects.reduce((sum, subject) => sum + (Number(subject.credit || 0) || 0), 0) || 0;
  const progressPercent = Math.min(100, Math.round((completedCredits / TOTAL_CREDITS_REQUIRED) * 100));

  const snapshot: AcademicTrackerSnapshot = {
    currentCgpa: cgpaSummary.currentCgpa || "0.00",
    currentSemesterNumber: cgpaSummary.semesterNumber,
    currentSemesterLabel:
      cgpaSummary.semesterLabel ||
      (cgpaSummary.semesterNumber ? `Semester ${cgpaSummary.semesterNumber}` : "Unavailable"),
    completedCredits,
    totalCreditsRequired: TOTAL_CREDITS_REQUIRED,
    progressPercent,
    semesterPerformance,
    overallAttendancePct,
    absenceCount,
    subjectsAtRisk,
    currentCourseCount,
    currentCourseCredits,
    internalAveragePct: internalModel?.averagePercentage || 0,
    strongestAttendanceSubject: toAttendanceSignal(attendanceModel, "strongest"),
    weakestAttendanceSubject: toAttendanceSignal(attendanceModel, "weakest"),
    strongestInternalSubject: toInternalSignal(internalModel, "strongest"),
    weakestInternalSubject: toInternalSignal(internalModel, "weakest"),
    gradeDistribution: summarizeGradeDistribution(historicalRecords),
    recommendations: [],
  };

  snapshot.recommendations = buildRecommendations(snapshot);

  if (!snapshot.currentSemesterNumber && currentResults?.subjects?.length) {
    const inferredSemester = parseSemesterNumber(currentResults.subjects[0]?.semester || "");
    snapshot.currentSemesterNumber = inferredSemester;
    snapshot.currentSemesterLabel = inferredSemester ? `Semester ${inferredSemester}` : snapshot.currentSemesterLabel;
  }

  return snapshot;
}
