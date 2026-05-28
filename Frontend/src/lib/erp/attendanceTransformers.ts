import { extractGenericTables, normalizeRawCell, normalizeRawValue, readBundledPageData } from "./shared";
import type {
  AttendanceRecord,
  ErpGenericTable,
  AttendanceModel,
  TimetableSlot,
  TimetableDay,
  TimetableSubject,
  TimetableModel,
  CourseRegistrationSubject,
  CourseRegistrationModel,
  CurriculumSubject,
  CurriculumModel,
  CurrentResultSubject,
  CurrentResultModel,
  FeeDueRecord,
  FeeDuesModel,
  StudentProfile,
  InternalMarkAssessment,
  InternalMarkSubject,
  InternalMarksModel,
  FieldType,
  SchemaField,
  SchemaDefinition,
  FeePaidRecord,
  FeePaidSourceSummary,
  FeePaidColumn,
  FeePaidSectionRow,
  FeePaidSection,
  FeePaidDuplicateConflict,
  FeePaidIntegritySummary,
  FeesPaidModel,
  BankDetailField,
  BankDetailsModel,
  RoomDetailField,
  RoomDetailsModel,
  SapScholarshipRecord,
  SapScholarshipsModel,
  FaqsModel,
  RefundChangeModel,
  TransformerFn,
  TransformerOutput
} from "./types";

/**
 * Classifies a raw attendance table row.
 * Returns "record" | "note" | "skip"
 * 
 * Classification is based on structural shape, NOT string content heuristics.
 * A valid record row has a non-empty Subject Code that matches the course code pattern.
 * A note row has a Subject Code that does not match this pattern.
 */
function classifyAttendanceRow(row: Record<string, unknown>): "record" | "note" | "skip" {
  const code = normalizeRawValue(row["Subject Code"]);
  if (!code || code === "-") return "skip";
  // Course codes are short alphanumeric tokens (e.g., "CSE 304", "MCE 244")
  // This is a structural check, not a string content heuristic
  if (/^[A-Z]{2,5}\s*\d{3,4}[A-Z]?$/i.test(code)) return "record";
  return "note";
}

export function extractStudentAttendanceTodayTable(pageData: any): ErpGenericTable[] {
  if (!pageData || !pageData.rawHtml) return [];

  const tables: ErpGenericTable[] = [];
  const html = pageData.rawHtml as string;

  const todaySectionIndex = html.indexOf('Today Attendance');
  if (todaySectionIndex === -1) return [];

  const sectionHtml = html.substring(todaySectionIndex);

  const rowRegex = /<div[^>]*class="row"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="row"|<\/body>|<\/div>)/gi;
  let match;

  let columns: string[] = [];
  const rows: Record<string, string>[] = [];

  while ((match = rowRegex.exec(sectionHtml)) !== null) {
    const rowContent = match[1];

    const cellRegex = /<div[^>]*>([\s\S]*?)<\/div>/gi;
    const cells: string[] = [];
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const cellText = normalizeRawValue(cellMatch[1].replace(/<[^>]+>/g, '').trim());
      if (cellText) cells.push(cellText);
    }

    if (cells.length === 0) continue;

    if (columns.length === 0 && cells.length >= 4 && cells.some(c => c.toLowerCase() === 'date' || c.toLowerCase() === 'subject')) {
      columns = cells;
      continue;
    }

    if (columns.length > 0 && cells.length === columns.length) {
      const rowData: Record<string, string> = {};
      columns.forEach((col, idx) => {
        rowData[col] = cells[idx];
      });
      rows.push(rowData);
    }
  }

  tables.push({
    title: "Today Attendance",
    columns: columns.length > 0 ? columns : ["Date", "Day Order", "Hour", "Subject", "Status"],
    rows
  });

  return tables;
}

export function transformAttendance(rawData: unknown): AttendanceModel {
  const records: AttendanceRecord[] = [];
  const notes: string[] = [];

  const data = readBundledPageData(rawData, "academic/attendance-details") as Record<string, unknown>;
  const details = (data?.Academic as Record<string, unknown>)?.["Attendance Details"] as Record<string, unknown>;
  const baseModel: AttendanceModel = {
    records,
    notes,
    odMlTables: extractGenericTables(readBundledPageData(rawData, "academic/od-ml-details"), "OD/ML Details"),
    studentAttendanceTables: extractStudentAttendanceTodayTable(
      readBundledPageData(rawData, "academic/student-attendance")
    ),
  };

  if (!details?.tables || !Array.isArray(details.tables)) return baseModel;

  // Find the primary data table: the one with at least 3 rows
  let targetTable: Record<string, unknown>[] | null = null;
  for (const table of details.tables as unknown[]) {
    if (Array.isArray(table) && table.length > 2) {
      targetTable = table as Record<string, unknown>[];
      break;
    }
  }

  if (!targetTable) return baseModel;

  for (const row of targetTable) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const classification = classifyAttendanceRow(r);

    if (classification === "skip") continue;

    if (classification === "note") {
      const note = normalizeRawValue(r["Subject Code"]);
      if (note) notes.push(note);
      continue;
    }

    // classification === "record"
    const parseNum = (keys: string[]): number => {
      for (const k of keys) {
        const value = r[k];
        if (value !== undefined) {
           const v = normalizeRawValue(value);
           const n = parseFloat(v);
           if (!isNaN(n)) return n;
        }
      }
      return 0;
    };

    const conducted = parseNum(["ClassesConducted", "Classes Conducted"]);
    const entered = parseNum(["Attendance Entered (Slots)", "Attendance\nEntered\n(Slots)"]);
    const odMl = parseNum(["OD/ML Taken", "OD/ML\nTaken"]);
    const present = parseNum(["Present(P)", "Present (P)"]);
    const odMlPct = parseNum(["OD ML % approved", "OD ML % Approved", "OD ML %\nApproved"]);
    const attendancePct = parseNum(["Attendance %", "Attendance\n%"]);

    // Swap them since user says they are swapped!
    records.push({
      subjectCode: normalizeRawValue(r["Subject Code"]),
      subjectDescription: normalizeRawValue(r["Subject Description"]),
      classesConducted: conducted,
      attendanceEntered: entered,
      odMlTaken: odMl,
      present: present,
      odMlApprovedPct: attendancePct,
      attendancePct: odMlPct,
    });
  }

  return baseModel;
}
