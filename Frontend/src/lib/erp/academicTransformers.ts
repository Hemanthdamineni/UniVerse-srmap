import { readExtracted, readExtractedPage } from "./shared";
import type {
  TimetableSlot,
  TimetableDay,
  TimetableSubject,
  TimetableModel,
  CourseRegistrationModel,
  CurriculumModel,
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

/**
 * Read _extracted from a page within a batched ERP response, falling back
 * to treating rawData as the page-level payload if the batch key is absent.
 * Returns null when the batch explicitly reports an error for this page key
 * (backend returned { success: false }), so the caller can return empty data
 * gracefully instead of throwing.
 */
function requireExtractedPage(
  rawData: unknown,
  pageKey: string,
  expectedType: string,
): Record<string, unknown> | null {
  const pageExtracted = readExtractedPage(rawData, pageKey, expectedType);
  if (pageExtracted !== null) {
    if (pageExtracted.type !== expectedType) {
      throw new Error(
        `UNEXPECTED_PAYLOAD_TYPE [${pageKey}]: expected "${expectedType}", got "${pageExtracted.type}". ` +
          `The backend extractor output type has changed or the wrong extractor is mapped.`,
      );
    }
    return pageExtracted;
  }

  // Batch entry has an explicit error — don't throw, let caller return empty data.
  const root = rawData as Record<string, unknown> | undefined;
  const entry = root?.[pageKey] as Record<string, unknown> | undefined;
  if (entry?.success === false) {
    return null;
  }

  return requireExtracted(rawData, expectedType, pageKey);
}

// ---------------------------------------------------------------------------
// TIMETABLE
// Backend extractor: extractTimetable → type "timetable"
// Shape: { type, title, timeSlots: string[], schedule: [{day, periods: string[]}],
//          subjects: [{code, description, ltpc, faculty, classroom}] }
// ---------------------------------------------------------------------------

export function transformTimetable(rawData: unknown): TimetableModel {
  // Accept both the full batch response (from Dashboard) and the page-level
  // payload (from individual timetable page fetch).
  const extracted = requireExtractedPage(rawData, "academic/time-table", "timetable");
  if (!extracted) {
    // Backend returned an error for this page — return empty model gracefully.
    return { timeSlots: [], days: [], subjects: [] };
  }
  const timeSlots = (extracted.timeSlots as string[] | undefined) ?? [];
  const scheduleRaw = (extracted.schedule as Record<string, unknown>[] | undefined) ?? [];
  const subjectsRaw = (extracted.subjects as Record<string, unknown>[] | undefined) ?? [];

  const days: TimetableDay[] = scheduleRaw.map((s) => ({
    day: String(s.day ?? ""),
    slots: ((s.periods as string[]) ?? []).map((text, idx): TimetableSlot => ({
      time: timeSlots[idx] ?? `Period ${idx + 1}`,
      classDetails: text,
    })),
  })).filter((d) => d.day);

  const seen = new Set<string>();
  const subjects: TimetableSubject[] = subjectsRaw
    .filter((s) => {
      const code = String(s.code ?? "");
      if (!code || seen.has(code)) return false;
      seen.add(code);
      return true;
    })
    .map((s) => ({
      code: String(s.code ?? ""),
      name: String(s.description ?? s.code ?? ""),
      ltpc: String(s.ltpc ?? ""),
      faculty: String(s.faculty ?? ""),
      room: String(s.classroom ?? ""),
    }));

  return { timeSlots, days, subjects };
}

// ---------------------------------------------------------------------------
// COURSE REGISTRATION
// Backend extractor: genericFor("COURSE REGISTRATION") → type "generic-table"
// Shape: { type, title, tables: [{columns, rows}], text }
// ---------------------------------------------------------------------------

export function transformCourseRegistration(rawData: unknown): CourseRegistrationModel {
  const extracted = requireExtracted(rawData, "generic-table", "academic/course-registration");
  const tables = (extracted.tables as Array<{ columns: string[]; rows: Record<string, unknown>[] }>) ?? [];
  const table = tables[0];

  if (!table || table.rows.length === 0) {
    return { subjects: [] };
  }

  const subjects = table.rows
    .map((row) => ({
      semester: String(row["Semester"] ?? row["semester"] ?? ""),
      code: String(row["Subject Code"] ?? row["Code"] ?? row["code"] ?? ""),
      description: String(row["Subject Desc"] ?? row["Description"] ?? row["Subject Description"] ?? ""),
      credit: String(row["Credit"] ?? row["credit"] ?? ""),
      group: String(row["Group"] ?? row["group"] ?? ""),
      subjectPart: String(row["Subject Part"] ?? row["subjectPart"] ?? ""),
    }))
    .filter((s) => s.code);

  return { subjects };
}

// ---------------------------------------------------------------------------
// CURRICULUM (Student Wise Subjects)
// Backend extractor: extractSubjects → type "subjects"
// Shape: { type, title, records: [{semester, code, name, credit, ltpc}] }
// ---------------------------------------------------------------------------

export function transformCurriculum(rawData: unknown): CurriculumModel {
  const extracted = requireExtracted(rawData, "subjects", "academic/curriculum");
  const records = Array.isArray(extracted.records) ? extracted.records : [];

  const subjects = records
    .map((r) => ({
      semester: String(r.semester ?? ""),
      code: String(r.code ?? ""),
      description: String(r.name ?? ""),
      credit: String(r.credit ?? ""),
      group: String(r.ltpc ?? ""),
    }))
    .filter((s) => s.code);

  return { subjects };
}
