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
    status: "hidden",
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
  "/academic/sap-scholarships": { ...erp("/academic/sap-scholarships", "SAP & Scholarships", ["sap/attachments", "sap/details"], "sap-scholarships", "Loading SAP and scholarship details..."), status: "hidden" as PageBlueprint["status"] },

  "/exams/current-semester-results": erp("/exams/current-semester-results", "Current Semester Results", [
    "examination/current-semester-results", "examination/internal-mark-details",
    "academic/course-registration", "academic/student-wise-subjects", "academic/cgpa-summary",
  ], "results-current", "Loading current semester results..."),
  "/exams/earlier-semester-results": erp("/exams/earlier-semester-results", "Earlier Semester Results", [
    "examination/earlier-internal-marks", "examination/exam-mark-details",
  ], "results-earlier", "Loading earlier semester results..."),
  "/exams/essentials": placeholder("/exams/essentials", "Exam Essentials", "Coming soon: this page is not yet available."),

  "/finance/fee-dues": erp("/finance/fee-dues", "Fees Dues", ["finance/fee-due-details"], "finance-dues", "Loading fee dues..."),
  "/finance/fee-paid": erp("/finance/fee-paid", "Fees Paid", ["finance/fee-paid-details", "finance/payment-acknowledgment", "finance/online-payment-verification"], "finance-paid", "Loading paid fees..."),
  "/finance/bank-details": { ...erp("/finance/bank-details", "Bank Details", ["finance/bank-account-details"], "bank-details", "Loading bank details..."), status: "hidden" as PageBlueprint["status"] },

  "/transport-hostel/routes": campus("/transport-hostel/routes", "Transport Routes", ["transport/transport-&-faqs"], "Loading transport routes..."),
  "/transport-hostel/hostel-booking": campus("/transport-hostel/hostel-booking", "Hostel Booking", ["hostel/hostel-booking-for-full-year"], "Loading hostel info..."),
  "/transport-hostel/room-details": { ...erp("/transport-hostel/room-details", "Rooms Details", ["hostel/room-details"], "room-details", "Loading room details..."), domain: "campus" },
  "/transport-hostel/route-details": campus("/transport-hostel/route-details", "Route Details", ["transport/transport-&-faqs"], "Loading route details..."),

  "/registration/course-registration": erp("/registration/course-registration", "Course Registration", ["academic/course-registration", "academic/course-registration-cancellation"], "document", "Loading course registration..."),
  "/registration/minor-oe-registration": { ...erp("/registration/minor-oe-registration", "Minor / OE Registration", ["academic/minor-program-registration"], "document", "Loading minor/OE registration..."), status: "hidden" as PageBlueprint["status"] },
  "/registration/events-registration": placeholder("/registration/events-registration", "Events Registration", "Coming soon: event registration is available from each event's details page."),
  "/registration/exam-registration": { ...erp("/registration/exam-registration", "Exam Registration", ["examination/exam-registration", "examination/exam-registration-details"], "document", "Loading exam registration..."), status: "hidden" as PageBlueprint["status"] },
  "/registration/hostel-registration": { ...erp("/registration/hostel-registration", "Hostel Registration", ["hostel/hostel-booking-for-full-year"], "document", "Loading hostel registration..."), domain: "campus" },
  "/registration/transport-registration": { ...erp("/registration/transport-registration", "Transport Registration", ["transport/transport-registration", "transport/registration-acknowledgment", "transport/transport-&-faqs"], "document", "Loading transport registration..."), domain: "campus" },
  "/registration/sap-registration": { ...erp("/registration/sap-registration", "SAP Registration", ["sap/sap-process"], "document", "Loading SAP registration..."), status: "hidden" as PageBlueprint["status"] },
  "/registration/registration-tracker": placeholder("/registration/registration-tracker", "Registration Tracker", "Coming soon: this page is not yet available."),
};
