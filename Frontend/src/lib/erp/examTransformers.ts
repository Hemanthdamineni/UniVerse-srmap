import { normalizeRawValue, readBundledPageData } from "./shared";
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

export function transformCurrentResults(rawData: unknown): Partial<CurrentResultModel> {
  if (!rawData || typeof rawData !== "object") return {};
  
  // Drill into Examination -> Current Semester Results
  const currentResultsData = readBundledPageData(rawData, "examination/current-semester-results");
  const root = currentResultsData as Record<string, unknown>;
  const examination = root.Examination as Record<string, unknown> | undefined;
  const section = (examination?.["Current Semester Results"] as Record<string, unknown> | undefined) || root;
  const title = normalizeRawValue(section.title);
  const textRaw = normalizeRawValue(section.text || "");
  
  // Extract SGPA
  const sgpaMatch = textRaw.match(/S\.G\.P\.A\s+([\d.]+)/i);
  let sgpa = sgpaMatch ? sgpaMatch[1] : "";

  // Extract disclaimer
  const disclaimerMatch = textRaw.match(/Disclaimer:(.*)/is);
  const disclaimer = disclaimerMatch ? disclaimerMatch[1].trim() : "";

  const subjects: CurrentResultSubject[] = [];
  const tables = section.tables;
  
  if (Array.isArray(tables) && Array.isArray(tables[0])) {
    const table = tables[0];
    for (const record of table) {
      if (!record || typeof record !== "object") continue;
      
      const r = record as Record<string, unknown>;
      const sem = normalizeRawValue(r.Semester);
      const code = normalizeRawValue(r["Subject Code"]);
      
      // Some rows hold SGPA or Disclaimer at the bottom inside the table
      if (sem.toUpperCase() === "S.G.P.A") {
        if (!sgpa) sgpa = code; // the next column usually
        continue;
      }
      if (sem.toLowerCase().includes("disclaimer") || code.toLowerCase().includes("disclaimer")) {
        continue;
      }

      if (code && sem) {
        subjects.push({
          semester: sem,
          subjectCode: code,
          subjectDescription: normalizeRawValue(r["Subject Description"]),
          credit: normalizeRawValue(r.Credit),
          grade: normalizeRawValue(r.Grade),
          result: normalizeRawValue(r.Result),
        });
      }
    }
  }

  const bundledInternalMarks = readBundledPageData(rawData, "examination/internal-mark-details");
  const internalMarks =
    bundledInternalMarks && bundledInternalMarks !== rawData
      ? transformInternalMarks(bundledInternalMarks) || undefined
      : transformInternalMarks(rawData) || undefined;

  return { title, sgpa, subjects, disclaimer, internalMarks };
}

interface TableSection {
  tables?: Array<Array<Record<string, unknown>>>;
  [key: string]: unknown;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeFieldName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeRawCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function readFlexibleField(row: Record<string, unknown>, candidates: string[]): string {
  for (const candidate of candidates) {
    const value = normalizeRawCell(row[candidate]);
    if (value) return value;
  }

  const normalizedCandidates = candidates.map(normalizeFieldName).filter(Boolean);
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeFieldName(key);
    if (!normalizedKey) continue;
    if (normalizedCandidates.some((candidate) => normalizedKey === candidate || normalizedKey.includes(candidate))) {
      const normalizedValue = normalizeRawCell(value);
      if (normalizedValue) return normalizedValue;
    }
  }

  return "";
}

function hasAnyFlexibleField(row: Record<string, unknown>, candidates: string[]) {
  return Boolean(readFlexibleField(row, candidates));
}

function extractSubjects(rows: Array<Record<string, unknown>>): InternalMarkSubject[] {
  const subjectCodeFields = ["Subject Code", "Course Code", "Sub Code", "Code", "col1"];
  const subjectDescriptionFields = [
    "Subject Description",
    "Subject Name",
    "Course Name",
    "Course Description",
    "Description",
    "col2",
  ];
  const marksObtainedFields = [
    "Marks Obtained",
    "Mark Secured(Converted)",
    "Mark Secured (Converted)",
    "Converted Marks",
    "Obtained Marks",
    "Marks",
    "Score",
    "col3",
  ];
  const maxMarksFields = [
    "Max.Marks",
    "Max. Marks",
    "Max Marks",
    "Maximum Marks",
    "Out Of",
    "Total Marks",
    "Mark Secured(Conducted)",
    "Mark Secured (Conducted)",
    "col4",
  ];
  const assessmentNameFields = ["Name", "Assessment", "Component", "Exam Name", "Test Name", "col1"];
  const assessmentConductedFields = [
    "Mark Secured(Conducted)",
    "Mark Secured (Conducted)",
    "Conducted Marks",
    "Marks Conducted",
    "col2",
  ];
  const assessmentConvertedFields = [
    "Mark Secured(Converted)",
    "Mark Secured (Converted)",
    "Converted Marks",
    "Marks Converted",
    "col3",
  ];
  const seen = new Set<string>();
  const subjects: InternalMarkSubject[] = [];
  let currentSubject: InternalMarkSubject | null = null;

  rows.forEach((row) => {
    const candidateCode = readFlexibleField(row, subjectCodeFields);
    const candidateDescription = readFlexibleField(row, subjectDescriptionFields);
    const maxMarksRaw = readFlexibleField(row, maxMarksFields);
    const isPlainMaxMarks = maxMarksRaw !== "" && /^\d+(\.\d+)?$/.test(maxMarksRaw.trim());
    const isCourseCode = /^[A-Z]{2,5}\s*\d{3,4}[A-Z]?$/i.test(candidateCode.trim());
    const isSubjectRow =
      candidateCode &&
      candidateDescription &&
      !/^name$/i.test(candidateCode) &&
      !/^subject code$/i.test(candidateCode) &&
      !/^name$/i.test(candidateDescription) &&
      !/^subject description$/i.test(candidateDescription) &&
      isPlainMaxMarks &&
      isCourseCode;

    if (isSubjectRow) {
      const code = readFlexibleField(row, subjectCodeFields) || "Unknown";
      const description = readFlexibleField(row, subjectDescriptionFields);
      const dedupeKey = `${code}::${description}`;
      if (seen.has(dedupeKey)) {
        currentSubject = subjects.find((subject) => `${subject.code}::${subject.description}` === dedupeKey) || null;
        return;
      }
      seen.add(dedupeKey);

      const marksObtained = toNumber(readFlexibleField(row, marksObtainedFields), 0);
      const maxMarks = toNumber(readFlexibleField(row, maxMarksFields), 100);
      const percentage = maxMarks > 0 ? (marksObtained / maxMarks) * 100 : 0;

      currentSubject = {
        code,
        description,
        marksObtained,
        maxMarks,
        percentage,
        status: percentage >= 80 ? "excellent" : percentage >= 60 ? "good" : "needs-improvement",
        detailTableIndex: 0,
        assessments: [],
      };
      subjects.push(currentSubject);
      return;
    }

    const assessmentName = readFlexibleField(row, assessmentNameFields);
    const conducted = readFlexibleField(row, assessmentConductedFields);
    const converted = readFlexibleField(row, assessmentConvertedFields);
    if (!currentSubject || !assessmentName || /^name$/i.test(assessmentName)) return;
    if (!conducted && !converted) return;

    currentSubject.assessments = [
      ...(currentSubject.assessments || []),
      { name: assessmentName, conducted, converted },
    ];
  });

  return subjects.map((subject, index) => ({ ...subject, detailTableIndex: index + 1 }));
}

function normalizeInternalMarksSource(marksData?: unknown): TableSection | null {
  const root = marksData && typeof marksData === "object" ? (marksData as Record<string, unknown>) : null;
  const examination = root?.Examination as Record<string, unknown> | undefined;
  const academic = root?.Academic as Record<string, unknown> | undefined;
  const examinationMarks = examination?.["Internal Mark Details"] as TableSection | undefined;
  const academicMarks = academic?.["Internal Mark Details"] as TableSection | undefined;

  if (Array.isArray(examinationMarks?.tables?.[0])) {
    return examinationMarks;
  }

  if (Array.isArray(academicMarks?.tables?.[0])) {
    return academicMarks;
  }

  if (academic && typeof academic === "object") {
    for (const [key, value] of Object.entries(academic)) {
      if (!/internal|mark/i.test(key)) continue;
      const candidate = value as TableSection | undefined;
      if (Array.isArray(candidate?.tables?.[0])) {
        return candidate;
      }
    }
  }

  const findSection = (value: unknown, keyHint = ""): TableSection | null => {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (/internal|mark/i.test(keyHint) && Array.isArray((record as TableSection).tables?.[0])) {
      return record as TableSection;
    }

    for (const [key, child] of Object.entries(record)) {
      const found = findSection(child, key);
      if (found) return found;
    }

    return null;
  };

  const discovered = findSection(root);
  if (discovered) return discovered;

  return null;
}

export function transformInternalMarks(rawData: unknown): InternalMarksModel | null {
  const source = normalizeInternalMarksSource(rawData);
  if (!source?.tables || !Array.isArray(source.tables)) return null;

  const allTables = source.tables.filter((t) => Array.isArray(t));
  if (!allTables.length) return null;

  // Table 0 is the master subject list (may also contain inline assessment rows)
  // Tables 1..N are per-subject assessment breakdowns in subject order
  const masterRows = allTables[0] as Array<Record<string, unknown>>;
  const assessmentTables = allTables.slice(1) as Array<Array<Record<string, unknown>>>;

  // Extract subjects from master table rows only
  const subjects = extractSubjects(masterRows);
  if (!subjects.length) return null;

  // If we have per-subject assessment tables, zip them onto subjects in order.
  // This is the clean data: Table[1] → subjects[0], Table[2] → subjects[1], etc.
  if (assessmentTables.length > 0) {
    const assessmentNameFields = ["Name", "Assessment", "Component", "Exam Name", "Test Name", "col1"];
    const assessmentConductedFields = [
      "Mark Secured(Conducted)",
      "Mark Secured (Conducted)",
      "Conducted Marks",
      "Marks Conducted",
      "col2",
    ];
    const assessmentConvertedFields = [
      "Mark Secured(Converted)",
      "Mark Secured (Converted)",
      "Converted Marks",
      "Marks Converted",
      "col3",
    ];

    assessmentTables.forEach((table, tableIndex) => {
      const subject = subjects[tableIndex];
      if (!subject) return;

      subject.assessments = table
        .map((row) => ({
          name: readFlexibleField(row, assessmentNameFields),
          conducted: readFlexibleField(row, assessmentConductedFields),
          converted: readFlexibleField(row, assessmentConvertedFields),
        }))
        .filter((a) => a.name && !(/^name$/i.test(a.name)));
    });
  }

  const validSubjects = subjects.filter((s) => s.maxMarks > 0);
  const averagePercentage = validSubjects.length
    ? validSubjects.reduce((acc, curr) => acc + curr.percentage, 0) / validSubjects.length
    : 0;

  return { subjects, averagePercentage };
}
