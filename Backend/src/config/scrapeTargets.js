const scrapeTargets = {
  dashboard: [
    { dropdown: "Academic", subitem: "Time Table" },
    { dropdown: "Academic", subitem: "Attendance Details" },
    { dropdown: "Examination", subitem: "Internal Mark Details" },
    { dropdown: "Announcements", subitem: "Announcements" },
  ],

  // Profile is handled specially in the live auth/session flow.
  // Do not point this to an unrelated menu item just to keep the key present.
  profile: [],

  "academic/time-table": [{ dropdown: "Academic", subitem: "Time Table" }],
  "academic/timetable": [{ dropdown: "Academic", subitem: "Time Table" }],
  "academic/attendance-details": [
    { dropdown: "Academic", subitem: "Attendance Details" },
    { dropdown: "Academic", subitem: "OD/ML Details" },
  ],
  "academic/student-wise-subjects": [
    { dropdown: "Academic", subitem: "Student Wise Subjects" },
  ],
  "academic/sap-scholarships": [
    { dropdown: "SAP", subitem: "Attachments" },
    { dropdown: "SAP", subitem: "Details" },
  ],
  "academic/course-registration": [
    { dropdown: "Academic", subitem: "Course Registration" },
    { dropdown: "Academic", subitem: "Course Registration Cancellation" },
  ],
  "academic/course-registration-cancellation": [
    { dropdown: "Academic", subitem: "Course Registration Cancellation" },
  ],
  "academic/od-ml-details": [{ dropdown: "Academic", subitem: "OD/ML Details" }],
  "academic/student-attendance": [{ dropdown: "Academic", subitem: "Student Attendance" }],
  "academic/minor-program-registration": [
    { dropdown: "Academic", subitem: "Minor Program Registration" },
  ],
  "academic/cgpa-summary": [{ dropdown: "Academic", subitem: "CGPA Summary" }],

  "examination/current-semester-results": [
    { dropdown: "Examination", subitem: "Current Semester Results" },
    { dropdown: "Examination", subitem: "Internal Mark Details" },
  ],
  "examination/earlier-internal-marks": [
    { dropdown: "Examination", subitem: "Earlier Internal Marks" },
    { dropdown: "Examination", subitem: "Exam Mark Details" },
  ],
  "examination/exam-mark-details": [{ dropdown: "Examination", subitem: "Exam Mark Details" }],
  "examination/internal-mark-details": [
    { dropdown: "Examination", subitem: "Internal Mark Details" },
  ],
  "examination/exam-registration": [
    { dropdown: "Examination", subitem: "Exam Registration" },
    { dropdown: "Examination", subitem: "Exam Registration Details" },
  ],
  "examination/exam-registration-details": [
    { dropdown: "Examination", subitem: "Exam Registration Details" },
  ],

  "finance/fee-due-details": [{ dropdown: "Finance", subitem: "Fee Due Details" }],
  "finance/fee-dues": [{ dropdown: "Finance", subitem: "Fee Due Details" }],
  "finance/fee-paid-details": [
    { dropdown: "Finance", subitem: "Fee Paid Details" },
  ],
  "finance/payment-acknowledgment": [
    { dropdown: "Finance", subitem: "Payment Acknowledgment" },
  ],
  "finance/online-payment-verification": [
    { dropdown: "Finance", subitem: "Online Payment Verification" },
  ],
  "finance/fee-paid": [
    { dropdown: "Finance", subitem: "Fee Paid Details" },
    { dropdown: "Finance", subitem: "Payment Acknowledgment" },
    { dropdown: "Finance", subitem: "Online Payment Verification" },
  ],
  "finance/bank-account-details": [
    { dropdown: "Finance", subitem: "Bank Account Details" },
  ],
  "finance/bank-details": [{ dropdown: "Finance", subitem: "Bank Account Details" }],

  "hostel/room-details": [{ dropdown: "Hostel", subitem: "Room Details" }],
  "transport-hostel/room-details": [{ dropdown: "Hostel", subitem: "Room Details" }],
  "hostel/hostel-layout-&-faqs": [{ dropdown: "Hostel", subitem: "Hostel Layout & FAQs" }],
  "transport-hostel/refund-change-requests": [
    { dropdown: "Hostel", subitem: "Hostel Refund Policy" },
    { dropdown: "Transport", subitem: "Transport Refund Policy" },
  ],
  "hostel/hostel-refund-policy": [{ dropdown: "Hostel", subitem: "Hostel Refund Policy" }],
  "transport/transport-refund-policy": [
    { dropdown: "Transport", subitem: "Transport Refund Policy" },
  ],

  "hostel/hostel-booking-for-full-year": [
    { dropdown: "Hostel", subitem: "Hostel Booking for Full Year" },
  ],
  "transport/transport-registration": [
    { dropdown: "Transport", subitem: "Transport Registration" },
    { dropdown: "Transport", subitem: "Registration Acknowledgment" },
  ],
  "transport/registration-acknowledgment": [
    { dropdown: "Transport", subitem: "Registration Acknowledgment" },
  ],
  "sap/attachments": [{ dropdown: "SAP", subitem: "Attachments" }],
  "sap/details": [{ dropdown: "SAP", subitem: "Details" }],
  "sap/feedback": [{ dropdown: "SAP", subitem: "Feedback" }],
  "sap/sap-process": [
    { dropdown: "SAP", subitem: "SAP Process", loadDetailsId: 44 },
  ],
  "sap/withdraw": [{ dropdown: "SAP", subitem: "Withdraw" }],

  "events/event-attendance": [{ dropdown: "Events", subitem: "Event Attendance" }],
  "feedback/end-semester-feedback": [
    { dropdown: "Feedback", subitem: "End Semester Feedback" },
  ],
  "verification/mobile-no-verification": [
    { dropdown: "Verification", subitem: "Mobile No Verification" },
  ],

  announcements: [{ dropdown: "Announcements", subitem: "Announcements" }],
  settings: [],
  logout: [],
};

module.exports = Object.freeze(scrapeTargets);
