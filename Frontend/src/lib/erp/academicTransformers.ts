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

function looksLikeLtpc(value: string) {
  return /^\d+\s*-\s*\d+\s*-\s*\d+\s*-\s*\d+$/i.test(normalizeRawValue(value));
}

function looksLikeRoom(value: string) {
  const normalized = normalizeRawValue(value);
  if (!normalized) return false;
  return /(?:\(|\b)([A-Z]{1,3}\s*\d{2,4})(?:\)|\b)/i.test(normalized);
}

export function transformTimetable(rawData: unknown): TimetableModel {
  const empty: TimetableModel = { timeSlots: [], days: [], subjects: [] };

  const data = rawData as Record<string, unknown>;
  const section = (data?.Academic as Record<string, unknown>)?.["Time Table"] as Record<string, unknown>;
  if (!section?.tables || !Array.isArray(section.tables) || section.tables.length < 2) return empty;

  const scheduleTable = section.tables[0] as Record<string, unknown>[];
  const subjectTable = section.tables[1] as Record<string, unknown>[];

  const timeHeaderRow =
    scheduleTable.find((row) => {
      const numericKeys = Object.keys(row || {}).filter((key) => /^\d+$/.test(key));
      if (!numericKeys.length) return false;
      return numericKeys.some((key) => normalizeRawValue(row[key]).includes(":"));
    }) ||
    scheduleTable.find((row) => Object.keys(row || {}).some((key) => /^\d+$/.test(key))) ||
    {};
  const timeSlotKeys = Object.keys(timeHeaderRow).filter(k => /^\d+$/.test(k));
  const timeSlots = timeSlotKeys.map(k => normalizeRawValue(timeHeaderRow[k])).filter(Boolean);

  const days: TimetableDay[] = [];
  for (const row of scheduleTable) {
    const dayName = normalizeRawValue(row.col1 ?? row.col2 ?? row["Day"]);
    if (!dayName || dayName === "-") continue;

    const slots: TimetableSlot[] = timeSlotKeys.map((key, idx) => ({
      time: timeSlots[idx] ?? `Period ${idx + 1}`,
      classDetails: normalizeRawValue(row[key]) === "-" ? "" : normalizeRawValue(row[key]),
    }));

    days.push({ day: dayName, slots });
  }

  const subjects: TimetableSubject[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < subjectTable.length; i++) {
    const row = subjectTable[i];

    // Handle both cases: normalized (with "Subject Code") and shifted (code in "Subjects Description")
    let code: string;
    let name: string;
    let ltpc: string;
    let faculty: string;
    let roomCandidate: string;

    if (row["Subjects Description"] && !row["Subject Code"]) {
      // Shifted case (backend normalization not applied)
      code = normalizeRawValue(row["Subjects Description"]);
      name = normalizeRawValue(row["L-T-P-C"]);
      ltpc = normalizeRawValue(row["Faculty Name"]);
      faculty = normalizeRawValue(row["Class Room Name"]);
      roomCandidate = normalizeRawValue(row.col5);
    } else {
      // Normal case
      code = normalizeRawValue(row["Subject Code"] || row["Code"] || row.col1);
      name = normalizeRawValue(
        row["Subject Description"] || row["Subject Desc"] || row["Subject Name"] || row["Description"] || row.col2
      );
      ltpc = normalizeRawValue(row["L-T-P-C"] || row["LTPC"] || row.col3);
      faculty = normalizeRawValue(
        row["Faculty Name"] || row["Faculty"] || row["Staff Name"] || row.col4
      );
      roomCandidate = normalizeRawValue(
        row["Class Room Name"] || row["Room"] || row["Class Room"] || row.col5
      );
    }

    if (!code || code === "-" || code.toLowerCase() === "subject code" || code.toLowerCase() === "subjects description") continue;
    if (seen.has(code)) continue;
    seen.add(code);

    const room = looksLikeRoom(roomCandidate) ? roomCandidate : "";

    subjects.push({
      code,
      name: name || code,
      ltpc: looksLikeLtpc(ltpc) ? ltpc : "",
      faculty: faculty || "",
      room,
    });
  }

  return { timeSlots, days, subjects };
}

export function transformCourseRegistration(rawData: unknown): CourseRegistrationModel {
  const empty: CourseRegistrationModel = { subjects: [] };
  const data = rawData as Record<string, unknown>;
  const section = (data?.Academic as Record<string, unknown>)?.["Course Registration"] as Record<string, unknown>;
  const tables = section?.tables as Array<Array<Record<string, unknown>>> | undefined;

  if (!tables || tables.length === 0 || !Array.isArray(tables[0])) {
    return empty;
  }

  const subjects = tables[0]
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      semester: normalizeRawValue(row["Semester"]),
      code: normalizeRawValue(row["Subject Code"] || row["Code"]),
      description: normalizeRawValue(row["Subject Desc"] || row["Description"] || row["Subject Description"]),
      credit: normalizeRawValue(row["Credit"]),
      group: normalizeRawValue(row["Group"]),
      subjectPart: normalizeRawValue(row["Subject Part"]),
    }))
    .filter((row) => row.code && row.code.toLowerCase() !== "subject code");

  return { subjects };
}

// ---------------------------------------------------------------------------
// 3b. CURRICULUM TRANSFORMER
// ---------------------------------------------------------------------------

export function transformCurriculum(rawData: unknown): CurriculumModel {
  const empty: CurriculumModel = { subjects: [] };
  const data = rawData as Record<string, unknown>;
  
  // Try to find the subjects table
  // Based on context, it's often under Academic -> "Student Wise Subjects"
  const section = (data?.Academic as Record<string, unknown>)?.["Student Wise Subjects"] as Record<string, unknown>;
  const tables = section?.tables as Array<Array<Record<string, unknown>>> | undefined;
  
  if (!tables || tables.length === 0) return empty;

  const subjectsTable = tables[0];
  const subjects: CurriculumSubject[] = [];

  for (let i = 0; i < subjectsTable.length; i++) {
    const row = subjectsTable[i];
    const semester = normalizeRawValue(row["Semester"] || row.col1);
    const code = normalizeRawValue(row["Code"] || row.col2);
    const description = normalizeRawValue(row["Description"] || row.col3);
    const credit = normalizeRawValue(row["Credit"] || row.col4);
    const group = normalizeRawValue(row["Group"] || row.col5);

    // Skip headers
    if (!code || code.toLowerCase() === "code" || code === "-") continue;

    subjects.push({
      semester,
      code,
      description,
      credit,
      group
    });
  }

  return { subjects };
}

// ---------------------------------------------------------------------------
// 3b. CURRENT RESULTS TRANSFORMER
// ---------------------------------------------------------------------------
