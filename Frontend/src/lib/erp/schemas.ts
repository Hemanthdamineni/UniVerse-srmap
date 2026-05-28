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

const attendanceRecordSchema: SchemaDefinition = {
  subjectCode: { type: "string", required: true },
  subjectDescription: { type: "string", required: true },
  classesConducted: { type: "number", required: true },
  attendanceEntered: { type: "number", required: true },
  odMlTaken: { type: "number", required: true },
  present: { type: "number", required: true },
  odMlApprovedPct: { type: "number", required: true },
  attendancePct: { type: "number", required: true },
};

const genericTableSchema: SchemaDefinition = {
  title: { type: "string", required: true },
  columns: { type: "array", required: true },
  rows: { type: "array", required: true },
};

const attendanceSchema: SchemaDefinition = {
  records: { type: "array", required: true, itemSchema: attendanceRecordSchema },
  notes: { type: "array", required: false },
  odMlTables: { type: "array", required: false, itemSchema: genericTableSchema },
  studentAttendanceTables: { type: "array", required: false, itemSchema: genericTableSchema },
};

const internalMarkSubjectSchema: SchemaDefinition = {
  code: { type: "string", required: true },
  description: { type: "string", required: true },
  marksObtained: { type: "number", required: true },
  maxMarks: { type: "number", required: true },
  percentage: { type: "number", required: true },
  status: { type: "string", required: true },
  detailTableIndex: { type: "number", required: true },
  assessments: { type: "array", required: false },
};

const internalMarksSchema: SchemaDefinition = {
  subjects: { type: "array", required: true, itemSchema: internalMarkSubjectSchema },
  averagePercentage: { type: "number", required: true },
};

const profileSchema: SchemaDefinition = {
  studentName: { type: "string", required: true },
  registerNo: { type: "string", required: true },
  dob: { type: "string", required: true },
  gender: { type: "string", required: true },
  academicYear: { type: "string", required: true },
  program: { type: "string", required: true },
  specialization: { type: "string", required: true },
  section: { type: "string", required: true },
  currentSemester: { type: "string", required: true },
  fatherName: { type: "string", required: true },
  motherName: { type: "string", required: true },
  contactNumber: { type: "string", required: true },
  email: { type: "string", required: true },
};

const timetableSlotSchema: SchemaDefinition = {
  time: { type: "string", required: true },
  classDetails: { type: "string", required: false },
};

const timetableDaySchema: SchemaDefinition = {
  day: { type: "string", required: true },
  slots: { type: "array", required: true, itemSchema: timetableSlotSchema },
};

const timetableSubjectSchema: SchemaDefinition = {
  code: { type: "string", required: true },
  name: { type: "string", required: true },
  ltpc: { type: "string", required: true },
  faculty: { type: "string", required: true },
  room: { type: "string", required: false },
};

const timetableSchema: SchemaDefinition = {
  timeSlots: { type: "array", required: true },
  days: { type: "array", required: true, itemSchema: timetableDaySchema },
  subjects: { type: "array", required: true, itemSchema: timetableSubjectSchema },
};

const currentResultSubjectSchema: SchemaDefinition = {
  semester: { type: "string", required: true },
  subjectCode: { type: "string", required: true },
  subjectDescription: { type: "string", required: true },
  credit: { type: "string", required: false }, // Some are empty for non-credit courses
  grade: { type: "string", required: true },
  result: { type: "string", required: true },
};

const currentResultsSchema: SchemaDefinition = {
  title: { type: "string", required: false },
  sgpa: { type: "string", required: false },
  subjects: { type: "array", required: true, itemSchema: currentResultSubjectSchema },
  disclaimer: { type: "string", required: false },
  internalMarks: { type: "object", required: false, objectSchema: internalMarksSchema },
};

const feeDueRecordSchema: SchemaDefinition = {
  category: { type: "string", required: true },
  head: { type: "string", required: true },
  dueAmount: { type: "string", required: true },
  collectedAmount: { type: "string", required: true },
  toBePaidAmount: { type: "string", required: true },
};

const feeDuesSchema: SchemaDefinition = {
  title: { type: "string", required: true },
  records: { type: "array", required: true, itemSchema: feeDueRecordSchema },
  noDues: { type: "boolean", required: true },
};

const curriculumSubjectSchema: SchemaDefinition = {
  semester: { type: "string", required: true },
  code: { type: "string", required: true },
  description: { type: "string", required: true },
  credit: { type: "string", required: true },
  group: { type: "string", required: true },
};

const curriculumSchema: SchemaDefinition = {
  subjects: { type: "array", required: true, itemSchema: curriculumSubjectSchema },
};

const courseRegistrationSubjectSchema: SchemaDefinition = {
  semester: { type: "string", required: true },
  code: { type: "string", required: true },
  description: { type: "string", required: true },
  credit: { type: "string", required: true },
  group: { type: "string", required: false },
  subjectPart: { type: "string", required: false },
};

const courseRegistrationSchema: SchemaDefinition = {
  subjects: { type: "array", required: true, itemSchema: courseRegistrationSubjectSchema },
};

const feePaidRecordSchema: SchemaDefinition = {
  slNo: { type: "string", required: true },
  amount: { type: "string", required: true },
  date: { type: "string", required: true },
  receiptNo: { type: "string", required: true },
  particulars: { type: "string", required: true },
  sourcePageKey: { type: "string", required: true },
  sourceLabel: { type: "string", required: true },
  sourcePageKeys: { type: "array", required: true },
  sourceLabels: { type: "array", required: true },
  stableKey: { type: "string", required: true },
  sourceRowIndex: { type: "number", required: true },
  duplicateCount: { type: "number", required: true },
  receiptId: { type: "string", required: false },
  actionId: { type: "string", required: false },
};

const feePaidSourceSummarySchema: SchemaDefinition = {
  sourcePageKey: { type: "string", required: true },
  sourceLabel: { type: "string", required: true },
  status: { type: "string", required: true },
  tableCount: { type: "number", required: true },
  rowCount: { type: "number", required: true },
  extractedCount: { type: "number", required: true },
  droppedRowCount: { type: "number", required: true },
  warnings: { type: "array", required: true },
};

const feePaidColumnSchema: SchemaDefinition = {
  key: { type: "string", required: true },
  label: { type: "string", required: true },
};

const feePaidSectionRowSchema: SchemaDefinition = {
  cells: { type: "object", required: true },
  printActionId: { type: "string", required: false },
  printReceiptId: { type: "string", required: false },
  stableKey: { type: "string", required: true },
};

const feePaidSectionSchema: SchemaDefinition = {
  sourceLabel: { type: "string", required: true },
  sourcePageKey: { type: "string", required: true },
  columns: { type: "array", required: true, itemSchema: feePaidColumnSchema },
  rows: { type: "array", required: true, itemSchema: feePaidSectionRowSchema },
  tableCount: { type: "number", required: true },
  extractedCount: { type: "number", required: true },
};

const feePaidDuplicateConflictSchema: SchemaDefinition = {
  stableKey: { type: "string", required: true },
  receiptNo: { type: "string", required: true },
  keptSourceLabel: { type: "string", required: true },
  droppedSourceLabel: { type: "string", required: true },
  fields: { type: "array", required: true },
  message: { type: "string", required: true },
};

const feePaidIntegritySchema: SchemaDefinition = {
  sourceCount: { type: "number", required: true },
  rawRowCount: { type: "number", required: true },
  extractedRowCount: { type: "number", required: true },
  deduplicatedRowCount: { type: "number", required: true },
  duplicateCount: { type: "number", required: true },
  warningCount: { type: "number", required: true },
};

const feesPaidSchema: SchemaDefinition = {
  title: { type: "string", required: true },
  records: { type: "array", required: true, itemSchema: feePaidRecordSchema },
  sections: { type: "array", required: true, itemSchema: feePaidSectionSchema },
  sources: { type: "array", required: true, itemSchema: feePaidSourceSummarySchema },
  duplicates: { type: "array", required: true, itemSchema: feePaidDuplicateConflictSchema },
  warnings: { type: "array", required: true },
  integrity: { type: "object", required: true, objectSchema: feePaidIntegritySchema },
};

const bankDetailFieldSchema: SchemaDefinition = {
  label: { type: "string", required: true },
  value: { type: "string", required: true },
};

const bankDetailsSchema: SchemaDefinition = {
  title: { type: "string", required: true },
  fields: { type: "array", required: true, itemSchema: bankDetailFieldSchema },
  isForm: { type: "boolean", required: false },
};

const roomDetailFieldSchema: SchemaDefinition = {
  label: { type: "string", required: true },
  value: { type: "string", required: true },
};

const roomDetailsSchema: SchemaDefinition = {
  title: { type: "string", required: true },
  fields: { type: "array", required: true, itemSchema: roomDetailFieldSchema },
  noRoom: { type: "boolean", required: true },
};

const sapScholarshipsSchema: SchemaDefinition = {
  title: { type: "string", required: true },
  tables: { type: "array", required: true },
  message: { type: "string", required: false },
};

const faqsSectionSchema: SchemaDefinition = {
  heading: { type: "string", required: true },
  text: { type: "string", required: true },
  url: { type: "string", required: false },
};

const faqsSchema: SchemaDefinition = {
  title: { type: "string", required: true },
  content: { type: "string", required: false },
  sections: { type: "array", required: true, itemSchema: faqsSectionSchema },
};

const refundChangeSectionSchema: SchemaDefinition = {
  heading: { type: "string", required: true },
  text: { type: "string", required: true },
  url: { type: "string", required: false },
};

const refundChangeSchema: SchemaDefinition = {
  title: { type: "string", required: true },
  content: { type: "string", required: false },
  sections: { type: "array", required: true, itemSchema: refundChangeSectionSchema },
};

export const schemas: Record<string, SchemaDefinition> = {
  attendance: attendanceSchema,
  "internal-marks": internalMarksSchema,
  profile: profileSchema,
  timetable: timetableSchema,
  "course-registration": courseRegistrationSchema,
  curriculum: curriculumSchema,
  "results-current": currentResultsSchema,
  "finance-dues": feeDuesSchema,
  "finance-paid": feesPaidSchema,
  "bank-details": bankDetailsSchema,
  "room-details": roomDetailsSchema,
  "sap-scholarships": sapScholarshipsSchema,
  faqs: faqsSchema,
  "refund-change": refundChangeSchema,
};
