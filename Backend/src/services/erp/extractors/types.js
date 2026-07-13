/**
 * Typed ERP data structures for targeted extraction.
 *
 * These replace the generic {title, text, tables[], document} blob with
 * strongly-typed domain objects. Each extractor function returns one of
 * these types, ensuring the frontend always receives predictable data.
 *
 * Modeled on Srmap-Api's TypeScript interfaces, but adapted to match the
 * actual SRM HTML structure observed in dump snapshots.
 *
 * @module erpExtractors/types
 */

/**
 * @typedef {Object} AttendanceRecord
 * @property {string} subjectCode
 * @property {string} subjectDescription
 * @property {string} classesConducted
 * @property {string} present
 * @property {string} absent
 * @property {string} odMlTaken
 * @property {string} presentPercentage
 * @property {string} odMlPercentage
 * @property {string} attendancePercentage
 */

/**
 * @typedef {Object} AttendanceData
 * @property {"attendance"} type
 * @property {string} title
 * @property {string} period - e.g. "05/Jan/2026 To 04/May/2026"
 * @property {AttendanceRecord[]} records
 * @property {string} [footnote] - e.g. "For any discrepancy..."
 */

/**
 * @typedef {Object} ProfileField
 * @property {string} label
 * @property {string} value
 */

/**
 * @typedef {Object} ProfileData
 * @property {"profile"} type
 * @property {string} title
 * @property {Record<string, string>} fields - e.g. { "Student Name": "...", "Register No.": "..." }
 * @property {ProfileField[]} fieldList - ordered list of label/value pairs
 */

/**
 * @typedef {Object} TimetableSlot
 * @property {string} day
 * @property {string[]} periods
 */

/**
 * @typedef {Object} SubjectInfo
 * @property {string} code
 * @property {string} description
 * @property {string} ltpc
 * @property {string} faculty
 * @property {string} classroom
 */

/**
 * @typedef {Object} TimetableData
 * @property {"timetable"} type
 * @property {string} title
 * @property {TimetableSlot[]} schedule
 * @property {SubjectInfo[]} subjects
 * @property {string[]} timeSlots - e.g. ["9:00 To 9:50", ...]
 */

/**
 * @typedef {Object} SubjectRecord
 * @property {string} semester
 * @property {string} code
 * @property {string} name
 * @property {string} ltpc
 * @property {string} credit
 */

/**
 * @typedef {Object} SubjectsData
 * @property {"subjects"} type
 * @property {string} title
 * @property {SubjectRecord[]} records
 */

/**
 * @typedef {Object} InternalMarkRecord
 * @property {string} subjectCode
 * @property {string} subjectName
 * @property {string} marksObtained
 * @property {string} totalMarks
 * @property {Object<string, string>} [components] - e.g. { "Mid Semester": "25/30", "Assignment": "10/10" }
 */

/**
 * @typedef {Object} InternalMarksData
 * @property {"internal-marks"} type
 * @property {string} title
 * @property {InternalMarkRecord[]} records
 */

/**
 * @typedef {Object} CgpaData
 * @property {"cgpa"} type
 * @property {string} title
 * @property {string} cgpa
 * @property {string} sourceText
 */

/**
 * @typedef {Object} FeeDueRecord
 * @property {string} slNo
 * @property {string} feeCategory
 * @property {string} feeHead
 * @property {string} dueAmount
 * @property {string} collected
 * @property {string} toBePaid
 */

/**
 * @typedef {Object} FeeDuesData
 * @property {"fee-dues"} type
 * @property {string} title
 * @property {FeeDueRecord[]} records
 * @property {{ dueAmount: string, collected: string, toBePaid: string }} totals
 * @property {string[]} paymentCategories - selectable fee categories
 * @property {string} [note]
 */

/**
 * @typedef {Object} FeePaidRecord
 * @property {string} [receiptNo]
 * @property {Object<string, string>} values - all column values keyed by header
 */

/**
 * @typedef {Object} FeePaidData
 * @property {"fee-paid"} type
 * @property {string} title
 * @property {string[]} columns
 * @property {FeePaidRecord[]} records
 */

/**
 * @typedef {Object} CurrentResultRecord
 * @property {string} subjectCode
 * @property {string} subjectName
 * @property {string} grade
 * @property {string} result
 * @property {Object<string, string>} [extras]
 */

/**
 * @typedef {Object} CurrentResultsData
 * @property {"current-results"} type
 * @property {string} title
 * @property {CurrentResultRecord[]} records
 */

/**
 * @typedef {Object} GenericExtractedData
 * @property {"generic"} type
 * @property {string} title
 * @property {string} text
 * @property {Array<{ columns: string[], rows: Object<string, string>[] }>} tables
 * @property {Object} [document] - the legacy document tree (fallback)
 */

/**
 * All possible extractor output types.
 * @typedef {AttendanceData | ProfileData | TimetableData | SubjectsData | InternalMarksData | CgpaData | FeeDuesData | FeePaidData | CurrentResultsData | GenericExtractedData} ExtractorResult
 */

module.exports = {};
