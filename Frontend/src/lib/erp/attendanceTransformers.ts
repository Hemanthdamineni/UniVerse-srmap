import { readExtracted, readExtractedPage } from "./shared";
import type {
  AttendanceRecord,
  ErpGenericTable,
  AttendanceModel,
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
  const pageExtracted = readExtractedPage(rawData, pageKey);
  if (pageExtracted !== null) {
    // Already-extracted object — validate type directly
    if (pageExtracted.type !== expectedType) {
      throw new Error(
        `UNEXPECTED_PAYLOAD_TYPE [${pageKey}]: expected "${expectedType}", got "${pageExtracted.type}". ` +
          `The backend extractor output type has changed or the wrong extractor is mapped.`,
      );
    }
    return pageExtracted;
  }
  // No bundled entry — treat rawData itself as the single-page payload
  return requireExtracted(rawData, expectedType, pageKey);
}

export function transformAttendance(rawData: unknown): AttendanceModel {
  const extracted = requireExtractedPage(rawData, "academic/attendance-details", "attendance");
  const records: AttendanceRecord[] = (extracted.records as Record<string, unknown>[]).map((r) => ({
    subjectCode: String(r.subjectCode ?? ""),
    subjectDescription: String(r.subjectDescription ?? ""),
    classesConducted: Number(r.classesConducted) || 0,
    attendanceEntered: Number(r.present) || 0,
    odMlTaken: Number(r.odMlTaken) || 0,
    present: Number(r.present) || 0,
    // Note: odMlApprovedPct and attendancePct fields are intentionally swapped
    // to match the SRM portal's display (confirmed by user).
    odMlApprovedPct: parseFloat(String(r.attendancePercentage ?? "0")) || 0,
    attendancePct: parseFloat(String(r.odMlPercentage ?? "0")) || 0,
  })).filter((r) => r.subjectCode);

  const notes: string[] = [];

  // OD/ML details — from a separate bundled page key
  const odMlExtracted = readExtractedPage(rawData, "academic/od-ml-details");
  let odMlTables: ErpGenericTable[] = [];
  if (odMlExtracted) {
    if (odMlExtracted.type !== "od-ml-details") {
      throw new Error(
        `UNEXPECTED_PAYLOAD_TYPE [academic/od-ml-details]: expected "od-ml-details", got "${odMlExtracted.type}".`,
      );
    }
    const odRecords = odMlExtracted.records as Record<string, unknown>[];
    if (odRecords.length > 0) {
      odMlTables = [
        {
          title: String(odMlExtracted.title ?? "OD/ML Details"),
          columns: ["From Date", "To Date", "Activity Type", "Days", "Description"],
          rows: odRecords.map((r) => ({
            "From Date": String(r.fromDate ?? ""),
            "To Date": String(r.toDate ?? ""),
            "Activity Type": String(r.activityType ?? ""),
            Days: String(r.days ?? ""),
            Description: String(r.description ?? ""),
          })),
        },
      ];
    }
  }

  // Student-attendance page is only used for the attendance code card (now hardcoded).
  // No transformer logic needed — the card always renders unconditionally.
  const studentAttendanceTables: ErpGenericTable[] = [];

  return { records, notes, odMlTables, studentAttendanceTables };
}
