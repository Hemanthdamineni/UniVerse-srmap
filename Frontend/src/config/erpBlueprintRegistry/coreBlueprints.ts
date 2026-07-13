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

function placeholder(route: string, heading: string, reason: string): PageBlueprint {
  return {
    route,
    heading,
    fetchKeys: [],
    domain: "campus",
    integrationState: "placeholder",
    renderer: "generic",
    placeholderReason: reason,
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
  "/academic/sap-scholarships": erp("/academic/sap-scholarships", "SAP & Scholarships", ["sap/attachments", "sap/details"], "sap-scholarships", "Loading SAP and scholarship details..."),

  "/exams/current-semester-results": erp("/exams/current-semester-results", "Current Semester Results", [
    "examination/current-semester-results", "examination/internal-mark-details",
    "academic/course-registration", "academic/student-wise-subjects", "academic/cgpa-summary",
  ], "results-current", "Loading current semester results..."),
  "/exams/earlier-semester-results": erp("/exams/earlier-semester-results", "Earlier Semester Results", [
    "examination/earlier-internal-marks", "examination/exam-mark-details",
  ], "results-earlier", "Loading earlier semester results..."),
  "/exams/essentials": {
    route: "/exams/essentials", heading: "Exam Essentials",
    fetchKeys: ["exams/essentials"], domain: "erp", sourceMode: "external",
    integrationState: "summary", renderer: "generic", loadingMessage: "Loading exam essentials...",
  } as PageBlueprint,

  "/finance/fee-dues": erp("/finance/fee-dues", "Fees Dues", ["finance/fee-due-details"], "finance-dues", "Loading fee dues..."),
  "/finance/fee-paid": erp("/finance/fee-paid", "Fees Paid", ["finance/fee-paid-details", "finance/payment-acknowledgment", "finance/online-payment-verification"], "finance-paid", "Loading paid fees..."),
  "/finance/bank-details": erp("/finance/bank-details", "Bank Details", ["finance/bank-account-details"], "bank-details", "Loading bank details..."),

  "/transport-hostel/room-details": { ...erp("/transport-hostel/room-details", "Rooms Details", ["hostel/room-details"], "room-details", "Loading room details..."), domain: "campus" },
  "/transport-hostel/route-details": placeholder("/transport-hostel/route-details", "Routes Details", "No university ERP source mapped."),
  "/transport-hostel/faqs": { ...campus("/transport-hostel/faqs", "FAQs", ["hostel/hostel-layout-&-faqs", "transport/transport-&-faqs"], "Loading FAQs..."), renderer: "faqs" as PageBlueprint["renderer"] },
  "/transport-hostel/refund-change-requests": { ...campus("/transport-hostel/refund-change-requests", "Refund & Change Requests", ["hostel/hostel-refund-policy", "transport/transport-refund-policy"], "Loading refund and change requests..."), renderer: "refund-change" as PageBlueprint["renderer"] },
  "/transport-hostel/outing-maintenance": placeholder("/transport-hostel/outing-maintenance", "Outing & Maintenance", "No university ERP source mapped."),

  "/registration/course-registration": erp("/registration/course-registration", "Course Registration", ["academic/course-registration", "academic/course-registration-cancellation"], "document", "Loading course registration..."),
  "/registration/minor-oe-registration": erp("/registration/minor-oe-registration", "Minor / OE Registration", ["academic/minor-program-registration"], "document", "Loading minor/OE registration..."),
  "/registration/events-registration": { route: "/registration/events-registration", heading: "Events Registration", fetchKeys: [], domain: "campus", sourceMode: "internal", integrationState: "native", renderer: "generic", loadingMessage: "Loading events registration..." } as PageBlueprint,
  "/registration/exam-registration": erp("/registration/exam-registration", "Exam Registration", ["examination/exam-registration", "examination/exam-registration-details"], "document", "Loading exam registration..."),
  "/registration/hostel-registration": { ...erp("/registration/hostel-registration", "Hostel Registration", ["hostel/hostel-booking-for-full-year"], "document", "Loading hostel registration..."), domain: "campus" },
  "/registration/transport-registration": { ...erp("/registration/transport-registration", "Transport Registration", ["transport/transport-registration", "transport/registration-acknowledgment"], "document", "Loading transport registration..."), domain: "campus" },
  "/registration/sap-registration": erp("/registration/sap-registration", "SAP Registration", ["sap/sap-process"], "document", "Loading SAP registration..."),
  "/registration/registration-tracker": placeholder("/registration/registration-tracker", "Registration Tracker", "No university ERP source mapped."),
};
