import { readExtracted, readExtractedPage } from "./shared";
import type {
  CurrentResultSubject,
  CurrentResultModel,
  InternalMarkSubject,
  InternalMarksModel,
  ExamMarkDetailsSubject,
  ExamMarkDetailsModel,
  ExamMarkDetailsSummary,
} from "./types";

function requireExtracted(
  pageData: unknown,
  expectedType: string,
  pageKey: string,
): Record<string, unknown> {
  const extracted = readExtracted(pageData);
  if (!extracted) {
    throw new Error(
      `MISSING_EXTRACTED_PAYLOAD [${pageKey}]: _extracted field is absent. ` +
        `The ERP page structure may have changed. Add or fix the backend extractor.`,
    );
  }
  if (extracted.type !== expectedType) {
    throw new Error(
      `UNEXPECTED_PAYLOAD_TYPE [${pageKey}]: expected "${expectedType}", got "${extracted.type}". ` +
        `The backend extractor output type has changed or the wrong extractor is mapped.`,
    );
  }
  return extracted;
}

function requireExtractedPage(
  rawData: unknown,
  pageKey: string,
  expectedType: string,
): Record<string, unknown> {
  const pageExtracted = readExtractedPage(rawData, pageKey, expectedType);
  if (pageExtracted !== null) {
    // Already-extracted object — validate type directly (do NOT re-wrap in readExtracted)
    if (pageExtracted.type !== expectedType) {
      throw new Error(
        `UNEXPECTED_PAYLOAD_TYPE [${pageKey}]: expected "${expectedType}", got "${pageExtracted.type}". ` +
          `The backend extractor output type has changed or the wrong extractor is mapped.`,
      );
    }
    return pageExtracted;
  }
  // No bundled entry found — treat rawData as the single-page payload (has ._extracted directly)
  return requireExtracted(rawData, expectedType, pageKey);
}

// ---------------------------------------------------------------------------
// CURRENT SEMESTER RESULTS
// Backend extractor: extractCurrentResults → type "current-results"
// Shape: { type, title, records: [{subjectCode, subjectName, grade, result,
//           extras: {semester, credit}}], semesterSummaries: [{label, value}] }
// ---------------------------------------------------------------------------

export function transformCurrentResults(rawData: unknown): Partial<CurrentResultModel> {
  const extracted = requireExtractedPage(
    rawData,
    "examination/current-semester-results",
    "current-results",
  );

  const title = String(extracted.title ?? "");

  const rawRecords = Array.isArray(extracted.records) ? extracted.records : [];
  const subjects: CurrentResultSubject[] = rawRecords
    .map((r) => {
      const extras =
        r.extras && typeof r.extras === "object"
          ? (r.extras as Record<string, unknown>)
          : {};
      return {
        semester: String(extras.semester ?? ""),
        subjectCode: String(r.subjectCode ?? ""),
        subjectDescription: String(r.subjectName ?? ""),
        credit: String(extras.credit ?? ""),
        grade: String(r.grade ?? ""),
        result: String(r.result ?? ""),
      };
    })
    .filter((s) => s.subjectCode);

  const summaries = Array.isArray(extracted.semesterSummaries)
    ? (extracted.semesterSummaries as Record<string, unknown>[])
    : [];
  const sgpaEntry = summaries.find((s) => String(s.label).includes("SGPA"));
  const sgpa = sgpaEntry ? String(sgpaEntry.value ?? "") : "";

  // Internal marks — bundled from a second page key in the same batch (optional)
  const internalMarksExtracted = readExtractedPage(rawData, "examination/internal-mark-details");
  const internalMarks = internalMarksExtracted
    ? buildInternalMarksFromExtracted(internalMarksExtracted)
    : undefined;

  return { title, sgpa, subjects, disclaimer: "", internalMarks: internalMarks ?? undefined };
}

// ---------------------------------------------------------------------------
// INTERNAL MARKS
// Backend extractor: extractInternalMarks → type "internal-marks"
// Shape: { type, title, records: [{subjectCode, subjectName, marksObtained, totalMarks}] }
// ---------------------------------------------------------------------------

/**
 * Build an InternalMarksModel from an already-extracted payload object.
 * Called internally by transformCurrentResults (which has already called readExtractedPage).
 */
function buildInternalMarksFromExtracted(
  extracted: Record<string, unknown>,
): InternalMarksModel | null {
  if (extracted.type !== "internal-marks") {
    throw new Error(
      `UNEXPECTED_PAYLOAD_TYPE [examination/internal-mark-details]: expected "internal-marks", got "${extracted.type}".`,
    );
  }
  return buildInternalMarks(extracted);
}

export function transformInternalMarks(rawData: unknown): InternalMarksModel | null {
  const extracted = requireExtractedPage(
    rawData,
    "examination/internal-mark-details",
    "internal-marks",
  );
  return buildInternalMarks(extracted);
}

function buildInternalMarks(extracted: Record<string, unknown>): InternalMarksModel | null {
  if (!Array.isArray(extracted.records)) return null;

  const subjects: InternalMarkSubject[] = (extracted.records as Record<string, unknown>[])
    .map((r, i) => {
      const marksObtained = parseFloat(String(r.marksObtained ?? "0")) || 0;
      const maxMarks = parseFloat(String(r.totalMarks ?? "100")) || 100;
      const percentage = maxMarks > 0 ? (marksObtained / maxMarks) * 100 : 0;
      return {
        code: String(r.subjectCode ?? ""),
        description: String(r.subjectName ?? ""),
        marksObtained,
        maxMarks,
        percentage,
        status:
          percentage >= 80 ? "excellent" : percentage >= 60 ? "good" : "needs-improvement",
        detailTableIndex: i + 1,
        assessments: [],
      } as InternalMarkSubject;
    })
    .filter((s) => s.code);

  if (!subjects.length) return null;

  const validSubjects = subjects.filter((s) => s.maxMarks > 0);
  const averagePercentage = validSubjects.length
    ? validSubjects.reduce((acc, curr) => acc + curr.percentage, 0) / validSubjects.length
    : 0;

  return { subjects, averagePercentage };
}

// ---------------------------------------------------------------------------
// EXAM MARK DETAILS (Historical Results)
// Backend extractor: extractExamMarkDetails → type "exam-mark-details"
// Shape: { type, title, records: [{semesterNo, monthYear, subjectCode, subjectName, credit, grade, gradePoints, result, attempt}], semesterSummaries: [{label, value}] }
// ---------------------------------------------------------------------------

export function transformExamMarkDetails(rawData: unknown): ExamMarkDetailsModel | null {
  const extracted = requireExtractedPage(
    rawData,
    "examination/exam-mark-details",
    "exam-mark-details",
  );

  const title = String(extracted.title ?? "EXAM MARK DETAILS");

  const rawRecords = Array.isArray(extracted.records) ? extracted.records : [];
  const records: ExamMarkDetailsSubject[] = rawRecords
    .map((r) => ({
      semesterNo: String(r.semesterNo ?? ""),
      monthYear: String(r.monthYear ?? ""),
      subjectCode: String(r.subjectCode ?? ""),
      subjectName: String(r.subjectName ?? ""),
      credit: String(r.credit ?? ""),
      grade: String(r.grade ?? ""),
      gradePoints: String(r.gradePoints ?? ""),
      result: String(r.result ?? ""),
      attempt: String(r.attempt ?? ""),
    }))
    .filter((s) => s.subjectCode);

  const summaries = Array.isArray(extracted.semesterSummaries)
    ? (extracted.semesterSummaries as Record<string, unknown>[])
    : [];
  const semesterSummaries: ExamMarkDetailsSummary[] = summaries.map((s) => ({
    label: String(s.label ?? ""),
    value: String(s.value ?? ""),
  }));

  return { title, records, semesterSummaries };
}
