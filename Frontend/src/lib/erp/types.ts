export interface ErpGenericTable {
  title: string;
  columns: string[];
  rows: Array<Record<string, string>>;
}

export interface AttendanceRecord {
  subjectCode: string;
  subjectDescription: string;
  classesConducted: number;
  attendanceEntered: number;
  odMlTaken: number;
  present: number;
  odMlApprovedPct: number;
  attendancePct: number;
}

export interface AttendanceModel {
  records: AttendanceRecord[];
  notes: string[];
  odMlTables?: ErpGenericTable[];
  studentAttendanceTables?: ErpGenericTable[];
}

export interface TimetableSlot {
  time: string;
  classDetails: string;
}

export interface TimetableDay {
  day: string;
  slots: TimetableSlot[];
}

export interface TimetableSubject {
  code: string;
  name: string;
  ltpc: string;
  faculty: string;
  room: string;
}

export interface TimetableModel {
  timeSlots: string[];
  days: TimetableDay[];
  subjects: TimetableSubject[];
}

export interface CourseRegistrationSubject {
  semester: string;
  code: string;
  description: string;
  credit: string;
  group: string;
  subjectPart: string;
}

export interface CourseRegistrationModel {
  subjects: CourseRegistrationSubject[];
}

export interface CurriculumSubject {
  semester: string;
  code: string;
  description: string;
  credit: string;
  group: string;
}

export interface CurriculumModel {
  subjects: CurriculumSubject[];
}

export interface InternalMarkAssessment {
  name: string;
  conducted: string;
  converted: string;
}

export interface InternalMarkSubject {
  code: string;
  description: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  status: "excellent" | "good" | "needs-improvement";
  detailTableIndex: number;
  assessments?: InternalMarkAssessment[];
}

export interface InternalMarksModel {
  subjects: InternalMarkSubject[];
  averagePercentage: number;
}

export interface CurrentResultSubject {
  semester: string;
  subjectCode: string;
  subjectDescription: string;
  credit: string;
  grade: string;
  result: string;
}

export interface CurrentResultModel {
  title: string;
  sgpa: string;
  subjects: CurrentResultSubject[];
  disclaimer: string;
  internalMarks?: InternalMarksModel;
}

export interface FeeDueRecord {
  category: string;
  head: string;
  dueAmount: string;
  collectedAmount: string;
  toBePaidAmount: string;
}

export interface FeeDuesModel {
  title: string;
  records: FeeDueRecord[];
  noDues: boolean;
}

export interface StudentProfile {
  studentName: string;
  registerNo: string;
  dob: string;
  gender: string;
  academicYear: string;
  program: string;
  specialization: string;
  section: string;
  currentSemester: string;
  fatherName: string;
  motherName: string;
  contactNumber: string;
  email: string;
}

export interface FeePaidRecord {
  slNo: string;
  amount: string;
  date: string;
  receiptNo: string;
  particulars: string;
  sourcePageKey: string;
  sourceLabel: string;
  sourcePageKeys: string[];
  sourceLabels: string[];
  stableKey: string;
  sourceRowIndex: number;
  duplicateCount: number;
  receiptId?: string | null;
  actionId?: string | null;
}

export interface FeePaidSourceSummary {
  sourcePageKey: string;
  sourceLabel: string;
  status: "loaded" | "empty" | "missing" | "failed";
  tableCount: number;
  rowCount: number;
  extractedCount: number;
  droppedRowCount: number;
  warnings: string[];
}

export interface FeePaidColumn {
  key: string;
  label: string;
}

export interface FeePaidSectionRow {
  cells: Record<string, string>;
  printActionId?: string | null;
  printReceiptId?: string | null;
  stableKey: string;
}

export interface FeePaidSection {
  sourceLabel: string;
  sourcePageKey: string;
  columns: FeePaidColumn[];
  rows: FeePaidSectionRow[];
  tableCount: number;
  extractedCount: number;
}

export interface FeePaidDuplicateConflict {
  stableKey: string;
  receiptNo: string;
  keptSourceLabel: string;
  droppedSourceLabel: string;
  fields: string[];
  message: string;
}

export interface FeePaidIntegritySummary {
  sourceCount: number;
  rawRowCount: number;
  extractedRowCount: number;
  deduplicatedRowCount: number;
  duplicateCount: number;
  warningCount: number;
}

export interface FeesPaidModel {
  title: string;
  records: FeePaidRecord[];
  sections: FeePaidSection[];
  sources: FeePaidSourceSummary[];
  duplicates: FeePaidDuplicateConflict[];
  warnings: string[];
  integrity: FeePaidIntegritySummary;
}

export interface BankDetailField {
  label: string;
  value: string;
}

export interface BankDetailsModel {
  title: string;
  fields: BankDetailField[];
  isForm?: boolean;
}

export interface RoomDetailField {
  label: string;
  value: string;
}

export interface RoomDetailsModel {
  title: string;
  fields: RoomDetailField[];
  noRoom: boolean;
}

export type SapScholarshipRecord = Record<string, string>;

export interface SapScholarshipsModel {
  title: string;
  tables: SapScholarshipRecord[][];
  message?: string;
}

export interface ExternalContentSection {
  heading: string;
  text: string;
  url?: string;
}

export interface FaqsModel {
  title: string;
  content?: string;
  sections: ExternalContentSection[];
}

export interface RefundChangeModel {
  title: string;
  content?: string;
  sections: ExternalContentSection[];
}

export type FieldType = "string" | "number" | "boolean" | "array" | "object";

export interface SchemaField {
  type: FieldType;
  required: boolean;
  itemSchema?: SchemaDefinition;
  objectSchema?: SchemaDefinition;
}

export type SchemaDefinition = Record<string, SchemaField>;

export type TransformerFn = (rawData: unknown) => unknown;

export interface TransformerOutput<T = unknown> {
  type: string;
  data: Partial<T> | null;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
