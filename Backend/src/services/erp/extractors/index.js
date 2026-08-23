/**
 * ERP Extractor Registry — routes page keys to targeted extractors.
 *
 * Each extractor takes raw HTML and returns a strongly-typed result object.
 * When a targeted extractor exists for a page, it replaces the generic
 * parseHtmlContent → erpDocumentBuilder → erpPayloadNormalizer pipeline.
 *
 * For pages without a targeted extractor, the system falls back to the
 * existing generic pipeline (with a warning log).
 *
 * @module erpExtractors/index
 */

const { extractAttendance } = require("./extractAttendance");
const { extractProfile } = require("./extractProfile");
const { extractTimetable } = require("./extractTimetable");
const { extractInternalMarks } = require("./extractInternalMarks");
const { extractFeeDues } = require("./extractFeeDues");
const { extractCurrentResults } = require("./extractCurrentResults");
const { extractSubjects } = require("./extractSubjects");
const { extractFeePaid } = require("./extractFeePaid");
const { extractPaymentAcknowledgment } = require("./extractPaymentAcknowledgment");
const { extractExamMarkDetails } = require("./extractExamMarkDetails");
const { extractOdMlDetails } = require("./extractOdMlDetails");
const { extractAnnouncements } = require("./extractAnnouncements");
const { extractBankDetails } = require("./extractBankDetails");
const { extractEarlierInternalMarks } = require("./extractEarlierInternalMarks");
const { extractEarlierInternalMarksSemester } = require("./extractEarlierInternalMarksSemester");
const { extractGenericTable } = require("./extractGenericTable");
const { extractTransport } = require("./extractTransport");
const { extractHostel } = require("./extractHostel");
const { extractTransportRegistrationAck } = require("./extractTransportRegistrationAck");
const { extractTransportRegistrationForm } = require("./extractTransportRegistrationForm");

// Convenience factory for generic-table pages with a specific expected title
const genericFor = (title) => (html) => extractGenericTable(html, title);

/**
 * Maps SRM dropdown|subitem identifiers to extractor functions.
 * The key format is "Dropdown|Subitem" as used internally.
 */
const SUBITEM_EXTRACTORS = {
  // ── Academic ──────────────────────────────────────────────────────────────
  "Academic|Attendance Details": extractAttendance,
  "Academic|Time Table": extractTimetable,
  "Academic|Student Wise Subjects": extractSubjects,
  "Academic|OD/ML Details": extractOdMlDetails,
  "Academic|OD_ML Details": extractOdMlDetails,
  "Academic|Student Attendance": genericFor("STUDENT ATTENDANCE"),
  "Academic|Course Registration": genericFor("COURSE REGISTRATION"),
  "Academic|Course Registration Cancellation": genericFor("COURSE REGISTRATION CANCELLATION"),
  "Academic|Minor Program Registration": genericFor("MINOR PROGRAM REGISTRATION"),
  "Academic|CGPA Summary": genericFor("CGPA SUMMARY"),

  // ── Examination ────────────────────────────────────────────────────────────
  "Examination|Internal Mark Details": extractInternalMarks,
  "Examination|Current Semester Results": extractCurrentResults,
  "Examination|Earlier Internal Marks": extractEarlierInternalMarks,
  "Examination|Exam Mark Details": extractExamMarkDetails,
  "Examination|Exam Registration": genericFor("EXAM REGISTRATION"),
  "Examination|Exam Registration Details": genericFor("Exam Application Details"),
  // Semester N pages — AJAX responses loaded by Earlier Internal Marks,
  // use dedicated extractor for the 6-column table structure
  "Examination|Semester 1": extractEarlierInternalMarksSemester,
  "Examination|Semester 2": extractEarlierInternalMarksSemester,
  "Examination|Semester 3": extractEarlierInternalMarksSemester,
  "Examination|Semester 4": extractEarlierInternalMarksSemester,
  "Examination|Semester 5": extractEarlierInternalMarksSemester,
  "Examination|Semester 6": extractEarlierInternalMarksSemester,
  "Examination|Semester 7": extractEarlierInternalMarksSemester,
  "Examination|Semester 8": extractEarlierInternalMarksSemester,

  // ── Finance ────────────────────────────────────────────────────────────────
  "Finance|Fee Due Details": extractFeeDues,
  "Finance|Fee Paid Details": extractFeePaid,
  "Finance|Payment Acknowledgment": extractPaymentAcknowledgment,
  "Finance|Bank Account Details": extractBankDetails,
  "Finance|Online Payment Verification": genericFor("ONLINE PAYMENT VERIFICATION"),

  // ── Hostel ────────────────────────────────────────────────────────────────
  "Hostel|Room Details": genericFor("Room Details"),
  "Hostel|Hostel Booking for Full Year": extractHostel,
  "Hostel|Hostel Layout & FAQs": genericFor("Hostel Layout & FAQs"),
  "Hostel|Hostel Refund Policy": genericFor("Hostel Refund Policy"),

  // ── Transport ─────────────────────────────────────────────────────────────
  "Transport|Transport Registration": extractTransportRegistrationForm,
  "Transport|Registration Acknowledgment": extractTransportRegistrationAck,
  "Transport|Transport Refund Policy": genericFor("Transport Refund Policy"),

  // ── SAP ───────────────────────────────────────────────────────────────────
  "SAP|Attachments": genericFor("SAP ATTACHMENTS"),
  "SAP|Details": genericFor("SAP DETAILS"),
  "SAP|Feedback": genericFor("SAP FEEDBACK"),
  "SAP|SAP Process": genericFor("SAP PROCESS"),
  "SAP|Withdraw": genericFor("SAP WITHDRAW"),

  // ── Events / Feedback / Verification / Announcements ─────────────────────
  "Events|Event Attendance": genericFor("Events"),
  "Feedback|End Semester Feedback": genericFor("End Semester Feedback"),
  "Verification|Mobile No Verification": genericFor("Mobile No Verification"),
  "Announcements|Announcements": extractAnnouncements,

  // ── Profile ───────────────────────────────────────────────────────────────
  // fetchProfileViaApi calls callEndpointViaApi with dropdown="Profile", subitem="Profile".
  // Without this entry the fail-loud guard throws UNREGISTERED_ERP_PAGE and blocks login.
  "Profile|Profile": extractProfile,
};

/**
 * Maps page keys (from scrapeTargets.js) to extractor functions.
 */
const PAGE_KEY_EXTRACTORS = {
  profile: extractProfile,
};

/**
 * Get a targeted extractor for the given dropdown/subitem combination.
 *
 * @param {string} dropdown - The dropdown menu name (e.g. "Academic")
 * @param {string} subitem - The subitem name (e.g. "Attendance Details")
 * @returns {{ extractor: Function, key: string } | null}
 */
function getSubitemExtractor(dropdown, subitem) {
  const key = `${dropdown}|${subitem}`;
  const extractor = SUBITEM_EXTRACTORS[key];
  if (extractor) {
    return { extractor, key };
  }
  return null;
}

/**
 * Get a targeted extractor for a top-level page key (e.g. "profile").
 *
 * @param {string} pageKey
 * @returns {Function | null}
 */
function getPageKeyExtractor(pageKey) {
  return PAGE_KEY_EXTRACTORS[pageKey] || null;
}

/**
 * Adapt a targeted extractor result to the legacy payload format
 * so it can pass through the existing pipeline without breaking
 * downstream consumers (caching, validation, frontend).
 *
 * The adapter wraps the typed result into the `{title, text, tables[], meta}`
 * shape that the rest of the system expects, while embedding the typed data
 * in a `._extracted` field for the frontend to consume directly.
 *
 * @param {import("./types").ExtractorResult} extracted - The typed extractor output
 * @returns {Object} Legacy-compatible payload
 */
function adaptToLegacyPayload(extracted) {
  if (!extracted || typeof extracted !== "object") {
    return { title: "", text: "", tables: [] };
  }

  const title = extracted.title || "";
  const type = extracted.type || "generic";

  // Build legacy tables array from typed data for backward compatibility
  const tables = [];

  if (type === "attendance" && Array.isArray(extracted.records)) {
    tables.push(
      extracted.records.map((record) => ({
        "Subject Code": record.subjectCode,
        "Subject Description": record.subjectDescription,
        "Classes Conducted": record.classesConducted,
        "Present(P)": record.present,
        "Absent(A)": record.absent,
        "OD/ML Taken": record.odMlTaken,
        "Present % P / (P+A+OD)": record.presentPercentage,
        "OD ML % approved": record.odMlPercentage,
        "Attendance %": record.attendancePercentage,
      }))
    );
  } else if (type === "internal-marks" && Array.isArray(extracted.records)) {
    tables.push(
      extracted.records.map((record) => ({
        "Subject Code": record.subjectCode,
        "Subject Description": record.subjectName,
        "Marks Obtained": record.marksObtained,
        "Max.Marks": record.totalMarks,
      }))
    );
  } else if (type === "current-results" && Array.isArray(extracted.records)) {
    tables.push(
      extracted.records.map((record) => ({
        Semester: record.extras?.semester || "",
        "Subject Code": record.subjectCode,
        "Subject Description": record.subjectName,
        Credit: record.extras?.credit || "",
        Grade: record.grade,
        Result: record.result,
      }))
    );
  } else if (type === "subjects" && Array.isArray(extracted.records)) {
    tables.push(
      extracted.records.map((record) => ({
        Semester: record.semester,
        Code: record.code,
        Description: record.name,
        Credit: record.credit,
      }))
    );
  } else if (type === "fee-dues" && Array.isArray(extracted.records)) {
    tables.push(
      extracted.records.map((record) => ({
        "Sl.No.": record.slNo,
        "Fee Category": record.feeCategory,
        "Fee Head": record.feeHead,
        "Due Amount (INR)": record.dueAmount,
        "Collected (INR)": record.collected,
        "To be Paid Amount (INR)": record.toBePaid,
      }))
    );
  } else if (type === "fee-paid" && Array.isArray(extracted.records)) {
    tables.push(extracted.records);
  } else if (type === "payment-acknowledgment" && Array.isArray(extracted.records)) {
    tables.push(
      extracted.records.map((r) => ({
        "Sl.No.": r.slNo,
        "Receipt Date": r.receiptDate,
        "Receipt No.": r.receiptNo,
        Particulars: r.particulars,
        Amount: r.amount,
      }))
    );
  } else if (type === "exam-mark-details" && Array.isArray(extracted.records)) {
    tables.push(
      extracted.records.map((r) => ({
        Semester: r.semesterNo,
        "Month Year": r.monthYear,
        "Subject Code": r.subjectCode,
        "Subject Description": r.subjectName,
        Credit: r.credit,
        Grade: r.grade,
        "Grade Points": r.gradePoints,
        Result: r.result,
      }))
    );
  } else if (type === "od-ml-details" && Array.isArray(extracted.records)) {
    tables.push(
      extracted.records.map((r) => ({
        "From Date": r.fromDate,
        "To Date": r.toDate,
        "Activity Type": r.activityType,
        "No. of Days": r.days,
        Description: r.description,
      }))
    );
  } else if (type === "announcements" && Array.isArray(extracted.records)) {
    tables.push(
      extracted.records.map((r) => ({
        Date: r.date,
        "Announcement Name": r.name,
        Enclosure: r.enclosure,
      }))
    );
  } else if (type === "bank-details" && Array.isArray(extracted.fields)) {
    const row = {};
    extracted.fields.forEach((f) => { row[f.label] = f.value; });
    tables.push([row]);
  } else if (type === "timetable" && Array.isArray(extracted.schedule)) {
    // Build a timetable grid: header row with day + time slots, then day rows
    const timeCols = (extracted.timeSlots || []).map((_, i) => `Period ${i + 1}`);
    if (timeCols.length) {
      const header = { Day: "Day" };
      timeCols.forEach((col, i) => {
        header[col] = (extracted.timeSlots || [])[i] || col;
      });
      tables.push([
        header,
        ...extracted.schedule.map((s) => {
          const row = { Day: s.day || "" };
          (s.periods || []).forEach((p, i) => {
            row[timeCols[i] || `Period ${i + 1}`] = p;
          });
          return row;
        }),
      ]);
    }
    // Subject list as second table
    if (Array.isArray(extracted.subjects) && extracted.subjects.length) {
      tables.push(
        extracted.subjects.map((s) => ({
          "Subject Code": s.code || "",
          "Subject Description": s.description || "",
          "L-T-P-C": s.ltpc || "",
          "Faculty Name": s.faculty || "",
          "Class Room": s.classroom || "",
        }))
      );
    }
  } else if (type === "earlier-internal-marks" && Array.isArray(extracted.records)) {
    tables.push(
      extracted.records.map((r) => ({
        "Subject Code": r.subjectCode,
        "Subject Description": r.subjectName,
        "Marks Obtained": r.marksObtained,
        "Max.Marks": r.totalMarks,
      }))
    );
  } else if (type === "generic-table" && Array.isArray(extracted.tables)) {
    // generic-table already has the right {columns, rows} structure
    extracted.tables.forEach((t) => {
      if (Array.isArray(t.rows) && t.rows.length > 0) {
        tables.push(t.rows);
      }
    });
  } else if (type === "transport-registration-ack" && Array.isArray(extracted.fields)) {
    // Convert fields to a single-row table for legacy compatibility
    const row = {};
    extracted.fields.forEach((f) => { row[f.label] = f.value; });
    tables.push([row]);
  }

  // Build meaningful text summary
  let text = title;
  if (type === "attendance" && extracted.period) {
    text = `${title} During the Period: ${extracted.period}`;
  } else if (type === "generic-table" && extracted.text) {
    text = extracted.text;
  } else if (type === "transport-registration-ack" && extracted.text) {
    text = extracted.text;
  }

  const payload = {
    title,
    text,
    tables,
    meta: {
      extractorType: type,
      extractorVersion: 1,
      usedTargetedExtractor: true,
    },
    // Embed the full typed result for frontends that can consume it directly
    _extracted: extracted,
  };

  // Profile gets special TableContent field
  if (type === "profile" && extracted.fields) {
    payload.TableContent = extracted.fields;
  }

  return payload;
}

/**
 * Check if a targeted extractor exists for the given context.
 *
 * @param {{ dropdown?: string, subitem?: string, pageKey?: string }} context
 * @returns {boolean}
 */
function hasTargetedExtractor(context) {
  if (context.pageKey && PAGE_KEY_EXTRACTORS[context.pageKey]) return true;
  if (context.dropdown && context.subitem) {
    return Boolean(SUBITEM_EXTRACTORS[`${context.dropdown}|${context.subitem}`]);
  }
  return false;
}

/**
 * List all registered extractor keys for diagnostic purposes.
 * @returns {string[]}
 */
function listRegisteredExtractors() {
  return [
    ...Object.keys(PAGE_KEY_EXTRACTORS).map((key) => `pageKey:${key}`),
    ...Object.keys(SUBITEM_EXTRACTORS).map((key) => `subitem:${key}`),
  ];
}



module.exports = {
  getSubitemExtractor,
  getPageKeyExtractor,
  adaptToLegacyPayload,
  hasTargetedExtractor,
  listRegisteredExtractors,
  // Re-export individual extractors for direct use
  extractAttendance,
  extractProfile,
  extractTimetable,
  extractInternalMarks,
  extractFeeDues,
  extractCurrentResults,
  extractSubjects,
  extractFeePaid,
  extractPaymentAcknowledgment,
  extractExamMarkDetails,
  extractOdMlDetails,
  extractAnnouncements,
  extractBankDetails,
  extractEarlierInternalMarks,
  extractEarlierInternalMarksSemester,
  extractGenericTable,
  extractTransportRegistrationAck,
};
