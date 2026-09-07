import type { PageBlueprint } from "../erpBlueprintTypes";

/** Default ERP page blueprint factory: domain=erp, sourceMode=erp, integrationState=native. */
function erp(
  route: string,
  heading: string,
  fetchKeys: string[],
  renderer: string,
  loadingMessage: string,
): PageBlueprint {
  return {
    route,
    heading,
    fetchKeys,
    loadingMessage,
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: renderer as PageBlueprint["renderer"],
  } as PageBlueprint;
}

function campus(route: string, heading: string, fetchKeys: string[], loadingMessage: string): PageBlueprint {
  return {
    route,
    heading,
    fetchKeys,
    loadingMessage,
    domain: "campus",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "generic",
  } as PageBlueprint;
}

export const CORE_PAGE_BLUEPRINTS: Record<string, PageBlueprint> = {

  "/dashboard": erp("/dashboard", "Dashboard", ["dashboard"], "dashboard", "Loading dashboard..."),

  "/academic/timetable": { ...erp("/academic/timetable", "Time Table", ["academic/time-table"], "timetable", "Loading time table..."), transform: "timetable" },
  "/academic/attendance-details": erp("/academic/attendance-details", "Attendance Details", ["academic/attendance-details", "academic/od-ml-details", "academic/student-attendance"], "attendance", "Loading attendance details..."),
  "/academic/curriculum": erp("/academic/curriculum", "Curriculum", ["academic/student-wise-subjects"], "curriculum", "Loading curriculum..."),
  "/campus/vacant-rooms": {
    route: "/campus/vacant-rooms",
    heading: "Vacant Rooms",
    fetchKeys: [],
    domain: "campus",
    sourceMode: "internal",
    integrationState: "native",
    renderer: "vacant-rooms",
    loadingMessage: "Finding vacant rooms...",
  } as PageBlueprint,
  "/academic/sap-scholarships": { ...erp("/academic/sap-scholarships", "SAP & Scholarships", ["sap/attachments", "sap/details"], "sap-scholarships", "Loading SAP and scholarship details..."), status: "hidden" as PageBlueprint["status"] },

  "/exams/current-semester-results": erp("/exams/current-semester-results", "Current Semester Results", [
    "examination/current-semester-results", "examination/internal-mark-details",
    "academic/course-registration", "academic/student-wise-subjects", "academic/cgpa-summary",
  ], "results-current", "Loading current semester results..."),
  "/exams/earlier-semester-results": erp("/exams/earlier-semester-results", "Earlier Semester Results", [
    "examination/earlier-internal-marks", "examination/exam-mark-details",
  ], "results-earlier", "Loading earlier semester results..."),
  "/finance/fee-dues": erp("/finance/fee-dues", "Fees Dues", ["finance/fee-due-details"], "finance-dues", "Loading fee dues..."),
  "/finance/fee-paid": erp("/finance/fee-paid", "Fees Paid", ["finance/fee-paid-details", "finance/payment-acknowledgment", "finance/online-payment-verification"], "finance-paid", "Loading paid fees..."),
  // B14 / T5.1.2 — Bank Details is a Finance page, now surfaced in the Finance
  // nav group rather than orphaned.
  "/finance/bank-details": erp("/finance/bank-details", "Bank Details", ["finance/bank-account-details"], "bank-details", "Loading bank details..."),

  "/transport-hostel/hostel-booking": campus("/transport-hostel/hostel-booking", "Hostel Booking", ["hostel/hostel-booking-for-full-year"], "Loading hostel info..."),
  "/transport-hostel/room-details": { ...erp("/transport-hostel/room-details", "Rooms Details", ["hostel/room-details"], "room-details", "Loading room details..."), domain: "campus" },

  // B14 / T5.1.1 — one tabbed hub replaces the six per-flow entries. The
  // per-flow blueprints below stay (the hub renders them, and they remain
  // directly navigable / deep-linkable via `?tab=`).
  "/registration": {
    route: "/registration",
    heading: "Registration",
    fetchKeys: [],
    domain: "erp",
    sourceMode: "erp",
    integrationState: "native",
    renderer: "generic",
    loadingMessage: "Loading registration...",
  } as PageBlueprint,
  "/registration/course-registration": { ...erp("/registration/course-registration", "Course Registration", ["academic/course-registration", "academic/course-registration-cancellation"], "document", "Loading course registration..."), status: "hidden" as PageBlueprint["status"] },
  "/registration/minor-oe-registration": { ...erp("/registration/minor-oe-registration", "Minor / OE Registration", ["academic/minor-program-registration"], "document", "Loading minor/OE registration..."), status: "hidden" as PageBlueprint["status"] },
  "/registration/exam-registration": { ...erp("/registration/exam-registration", "Exam Registration", ["examination/exam-registration", "examination/exam-registration-details"], "document", "Loading exam registration..."), status: "hidden" as PageBlueprint["status"] },
  "/registration/hostel-registration": { ...erp("/registration/hostel-registration", "Hostel Registration", ["hostel/hostel-booking-for-full-year"], "document", "Loading hostel registration..."), domain: "campus", status: "hidden" as PageBlueprint["status"] },
  "/registration/transport-registration": { ...erp("/registration/transport-registration", "Transport Registration", ["transport/transport-registration", "transport/registration-acknowledgment"], "document", "Loading transport registration..."), domain: "campus", status: "hidden" as PageBlueprint["status"] },
  "/registration/sap-registration": { ...erp("/registration/sap-registration", "SAP Registration", ["sap/sap-process"], "document", "Loading SAP registration..."), status: "hidden" as PageBlueprint["status"] },
};
