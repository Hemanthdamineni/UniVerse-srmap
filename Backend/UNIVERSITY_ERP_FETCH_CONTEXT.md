# SRM AP ERP Fetching Context (Minimal)

Use this as the only university-specific context for AI implementations. It describes what SRM ERP expects and what it returns.

## 1) Base ERP Target
- Base origin: `https://student.srmap.edu.in`
- Base path: `/srmapstudentcorner`
- Login page (session bootstrap): `GET /StudentLoginPage`
- Captcha image: `GET /captchas`
- Login submit: `POST /StudentLoginToPortal`

All internal requests are relative to:
- `https://student.srmap.edu.in/srmapstudentcorner/`

## 2) Auth Expectations (exact field names)
SRM ERP login POST expects `application/x-www-form-urlencoded` fields:
- `txtUserName`: registration/user id
- `txtAuthKey`: password
- `ccode`: captcha text

Login-failure indicators in returned HTML (string match):
- `invalid captcha`
- `invalid login`
- `studentloginpage`

## 3) Session/Cookie Model
- Session is cookie-driven. You must keep and reuse cookies from:
  - `GET StudentLoginPage` (before captcha)
  - `GET captchas`
  - `POST StudentLoginToPortal`
- Subsequent data fetches require the same authenticated cookie jar.
- Request headers that improve stability:
  - `Referer: https://student.srmap.edu.in/srmapstudentcorner/StudentLoginPage`
  - `Origin: https://student.srmap.edu.in`
  - Browser-like `User-Agent`

## 4) Internal Data Endpoint Pattern
Discovered map on `2026-02-20` shows:
- Total menu items: `36`
- Resolved: `36`
- Internal (ERP HTML) items: `32`
- External links: `4`

Main pattern:
- Most pages are `POST` with form params.
- Dominant endpoint: `students/report/studentreportresources.jsp` with `ids=<argId>`.
- Several pages use specific JSP endpoints.

Common payload pattern:
- `ids`: numeric menu/function id (string in form body)
- Optional `stuId`: appears in some endpoints in discovery output
- Some endpoints include extra optional fields (example: `txnid`, `msgs`)

Important practical note:
- Discovery currently includes `stuId: "14688"` on some entries (from the account used during discovery).
- Treat `stuId` as user/session-specific dynamic data. Do not hardcode `14688` for all users.

## 5) Resolved Menu -> Endpoint Map (SRM-specific)

`Academic`
- Student Wise Subjects -> `POST students/report/studentreportresources.jsp` params `{ ids: 2 }`
- Time Table -> `POST students/report/studentreportresources.jsp` params `{ ids: 10 }`
- Attendance Details -> `POST students/report/studentreportresources.jsp` params `{ ids: 3 }`
- OD/ML Details -> `POST students/report/studentreportresources.jsp` params `{ ids: 53 }`
- Student Attendance -> `POST students/transaction/studentattendance.jsp` params `{ ids: 33, stuId: <dynamic> }`
- Course Registration -> `POST students/registrations/studentscourseregistrationinstruction2022.jsp` params `{ ids: 39 }`
- Course Registration Cancellation -> `POST students/registrations/studentscourseregistrationcurrentsemesterinstruction.jsp` params `{ ids: 42 }`
- Minor Program Registration -> `POST students/registrations/minorregistrationinstruction.jsp` params `{ ids: 152 }`

`Events`
- Event Attendance -> `POST students/transaction/eventattendance.jsp` params `{ ids: 1 }`

`SAP`
- SAP Process -> `POST students/registrations/sapregistrationinstruction.jsp` params `{ ids: 43 }`
- Withdraw -> `POST students/registrations/sapwithdraw.jsp` params `{ ids: 46 }`
- Details -> `POST students/report/studentreportresources.jsp` params `{ ids: 47 }`
- Attachments -> `POST students/registrations/sapattachfiles.jsp` params `{ ids: 48 }`
- Feedback -> `POST students/registrations/sapfeedback.jsp` params `{ ids: 49 }`

`Finance`
- Fee Paid Details -> `POST students/report/studentreportresources.jsp` params `{ ids: 7 }`
- Fee Due Details -> `POST students/transaction/feeduegroups.jsp` params `{ ids: 8 }`
- Online Payment Verification -> `POST students/onlinepayments/onlinepaymentreconcilation.jsp` params `{ ids: 26, stuId: <dynamic> }`
- Payment Acknowledgment -> `POST students/report/receiptgeneration.jsp` params `{ ids: 27, stuId: <dynamic> }`
- Bank Account Details -> `POST students/transaction/studentbankdetails.jsp` params `{ ids: 54 }`

`Examination`
- Internal Mark Details -> `POST students/report/studentreportresources.jsp` params `{ ids: 5 }`
- Earlier Internal Marks -> `POST students/report/studentreportresources.jsp` params `{ ids: 22 }`
- Current Semester Results -> `POST students/report/studentreportresources.jsp` params `{ ids: 15 }`
- Exam Mark Details -> `POST students/report/studentreportresources.jsp` params `{ ids: 6 }`
- Exam Registration -> `POST students/transaction/semesterexamapplicationinstruction.jsp` params `{ ids: 13 }`
- Exam Registration Details -> `POST students/report/examaplicationreport.jsp` params `{ ids: 159 }`

`Hostel`
- Hostel Booking for Full Year -> `POST students/registrations/hostelregistrationinstruction.jsp` params `{ ids: 31 }`
- Room Details -> `POST students/report/studentreportresources.jsp` params `{ ids: 21 }`
- Hostel Layout & FAQs -> external `GET https://srmap.edu.in/hostel/layout/`
- Hostel Refund Policy -> external `GET https://srmap.edu.in/hostel/`

`Transport`
- Transport Registration -> `POST students/registrations/transportregistrationinstructions.jsp` params `{ ids: 51 }`
- Registration Acknowledgment -> `POST students/report/transportconfirmationprint.jsp` params `{ ids: 52 }`
- Transport & FAQs -> external `GET //www.srmap.edu.in/transport`
- Transport Refund Policy -> external PDF URL

`Feedback`
- End Semester Feedback -> `POST students/transaction/subjectwisefeedback.jsp` params `{ ids: 9 }`

`Announcements`
- Announcements -> `POST students/report/announcements.jsp` params `{ ids: 107, stuId: <dynamic> }`

`Verification`
- Mobile No Verification -> `POST students/transaction/mobilenumberverification.jsp` params `{ ids: 1 }`

## 6) Response Content You Should Expect
Content type for internal pages is typically:
- `text/html;charset=UTF-8`

Response format is HTML (not JSON). Typical structure:
- Main container often `#divContent`
- Optional heading in `h1/h2/h3`
- One or more `<table>` elements
- Mixed pages: real rows + repeated header rows inside body

## 7) Normalized Output Shape (recommended)
A robust parser should return:
- `title`: heading text
- `text`: cleaned text content (full page)
- `tables`: array of table rows as key-value objects
- Optional `TableContent`: profile-style key/value extraction (`key : value` rows)

Recommended normalized object:
```json
{
  "title": "TIME TABLE",
  "text": "...",
  "tables": [
    [
      { "col1": "Monday", "1": "09:00 To 09:50" }
    ]
  ],
  "TableContent": {
    "Student Name": "..."
  }
}
```

## 8) Real Examples from Your Captured Data
From `data/direct-api-output/fetched-endpoints.json`:
- Student Wise Subjects:
  - endpoint: `POST students/report/studentreportresources.jsp` + `ids=2`
  - returns heading `STUDENT WISE SUBJECTS`
  - table headers include: `Semester`, `Code`, `Description`, `Credit`, `Group`
- Time Table:
  - endpoint: same JSP + `ids=10`
  - returns heading `TIME TABLE`
  - multiple tables, periodic schedule + subject/faculty table
- Attendance Details:
  - endpoint: same JSP + `ids=3`
  - returns heading `ATTENDANCE DETAILS`
  - includes period range text and attendance summary table

## 9) Minimum Files to Give Another AI (University-only)
- `Backend/src/config/env.js`
- `Backend/src/services/erpClient.js`
- `Backend/src/services/htmlParser.js`
- `Backend/data/endpoint-discovery.json`
- `Backend/data/direct-api-output/fetched-endpoints.json` (for concrete return samples)

This is enough for another AI to implement SRM AP ERP fetching behavior in any architecture.
