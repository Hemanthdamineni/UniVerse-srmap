# 05 — ERP Integration

## 5.1 Target System

| Property | Value |
|----------|-------|
| **System** | SRM AP University Student ERP |
| **Base URL** | `https://student.srmap.edu.in/srmapstudentcorner` |
| **Technology** | JSP/Servlet, returns HTML |
| **Auth** | Cookie-based session, CAPTCHA-protected login |
| **API** | None — all data is embedded in HTML pages |
| **Endpoints** | 32 internal JSP endpoints + 4 external links |
| **Request Pattern** | Mostly `POST` with `ids=<argId>` form parameter |

---

## 5.2 ERP Authentication

### Login Sequence

```
Step 1: Bootstrap session
  GET /srmapstudentcorner/StudentLoginPage
  → Sets initial session cookies (JSESSIONID, etc.)

Step 2: Fetch captcha
  GET /srmapstudentcorner/captchas
  → Returns CAPTCHA image (reuses same cookie jar)

Step 3: Submit credentials
  POST /srmapstudentcorner/StudentLoginToPortal
  Content-Type: application/x-www-form-urlencoded
  Body: txtUserName=<regNo>&txtAuthKey=<password>&ccode=<captchaText>
  Headers:
    Referer: https://student.srmap.edu.in/srmapstudentcorner/StudentLoginPage
    Origin: https://student.srmap.edu.in
    User-Agent: <browser-like>
  
  → On success: Redirects to dashboard, cookies now authenticated
  → On failure: HTML contains "invalid captcha", "invalid login", or "studentloginpage"
```

### Login Failure Detection
The system checks response HTML for these patterns:
- `invalid captcha`
- `invalid login`
- `studentloginpage`

### Session Cookie Model
- Session is **entirely cookie-driven**
- Cookies must be preserved across: `GET StudentLoginPage` → `GET captchas` → `POST StudentLoginToPortal` → all subsequent data requests
- The platform uses **Playwright's `storageState`** to serialize/restore the entire cookie jar

---

## 5.3 Playwright Usage

**Important distinction:** Playwright is used **strictly as an HTTP request client**, NOT as a browser automation engine.

```javascript
// Creating a fresh browser context (for login)
const browser = await chromium.launch();
const context = await browser.newContext();

// Making requests (the only Playwright API used at runtime)
const api = context.request;  // APIRequestContext
await api.get(url);
await api.post(url, { form: data });

// Saving session state (cookies + origins)
const storageState = await context.storageState();
// → { cookies: [...], origins: [...] }

// Restoring session state (for authenticated requests)
const context = await browser.newContext({ storageState });
```

**Why Playwright over Axios/fetch?**
- Built-in cookie jar management
- Automatic redirect following with cookie propagation
- Browser-like HTTP behavior (important for JSP compatibility)
- `storageState` serialization/restoration for session persistence

---

## 5.4 Endpoint Discovery

### Offline Discovery Process
ERP endpoints are **not hardcoded**. They are discovered by an offline Playwright script:

```bash
npm run discover:endpoints
# → Launches real browser
# → Logs into ERP
# → Inspects JavaScript menu mappings
# → Extracts function calls (e.g., funStudentWiseSubjects(2))
# → Maps each menu item to its HTTP endpoint
# → Generates Backend/data/endpoint-discovery.json
```

### Discovery Output Format
```json
{
  "discoveredAt": "2026-02-20T...",
  "totalMenuItems": 36,
  "resolved": 36,
  "items": [
    {
      "dropdown": "Academic",
      "subitem": "Attendance Details",
      "method": "POST",
      "url": "students/report/studentreportresources.jsp",
      "params": { "ids": "3" },
      "functionName": "funAttendanceDetails",
      "type": "internal"
    }
  ]
}
```

### Endpoint Map (Full)

#### Academic
| Menu Item | Endpoint | Params |
|-----------|----------|--------|
| Student Wise Subjects | `POST studentreportresources.jsp` | `ids=2` |
| Time Table | `POST studentreportresources.jsp` | `ids=10` |
| Attendance Details | `POST studentreportresources.jsp` | `ids=3` |
| OD/ML Details | `POST studentreportresources.jsp` | `ids=53` |
| Student Attendance | `POST studentattendance.jsp` | `ids=33, stuId=<dynamic>` |
| Course Registration | `POST studentscourseregistrationinstruction2022.jsp` | `ids=39` |
| Course Reg. Cancellation | `POST studentscourseregistrationcurrentsemesterinstruction.jsp` | `ids=42` |
| Minor Program Registration | `POST minorregistrationinstruction.jsp` | `ids=152` |

#### Examination
| Menu Item | Endpoint | Params |
|-----------|----------|--------|
| Internal Mark Details | `POST studentreportresources.jsp` | `ids=5` |
| Earlier Internal Marks | `POST studentreportresources.jsp` | `ids=22` |
| Current Semester Results | `POST studentreportresources.jsp` | `ids=15` |
| Exam Mark Details | `POST studentreportresources.jsp` | `ids=6` |
| Exam Registration | `POST semesterexamapplicationinstruction.jsp` | `ids=13` |
| Exam Registration Details | `POST examaplicationreport.jsp` | `ids=159` |

#### Finance
| Menu Item | Endpoint | Params |
|-----------|----------|--------|
| Fee Paid Details | `POST studentreportresources.jsp` | `ids=7` |
| Fee Due Details | `POST feeduegroups.jsp` | `ids=8` |
| Online Payment Verification | `POST onlinepaymentreconcilation.jsp` | `ids=26, stuId=<dynamic>` |
| Payment Acknowledgment | `POST receiptgeneration.jsp` | `ids=27, stuId=<dynamic>` |
| Bank Account Details | `POST studentbankdetails.jsp` | `ids=54` |

### Fee-Paid Source Integrity
The `/finance/fee-paid` UX is intentionally sourced from three distinct ERP menu items:

| Frontend fetch key | ERP menu item | Purpose |
|--------------------|---------------|---------|
| `finance/fee-paid-details` | Fee Paid Details | Ledger-style paid-fee rows |
| `finance/payment-acknowledgment` | Payment Acknowledgment | Receipt history and print actions |
| `finance/online-payment-verification` | Online Payment Verification | Gateway verification rows |

Production rules:
- Each fetch key maps to exactly one ERP menu item in `Backend/src/config/scrapeTargets.js`.
- Backend V2 responses include `meta.financePaidIntegrity.sources[]` with per-source table and row counts.
- The frontend fee-paid transformer merges by stable key: `receiptNo` when present, otherwise an FNV-1a hash of date, amount, and particulars.
- Displayed rows always carry `sourcePageKey`, `sourceLabel`, `sourcePageKeys`, and `sourceLabels`.
- Partial source failures remain visible in the UI as warnings while loaded sources continue to render.
- Print actions execute against the row's `sourcePageKey`, not a hardcoded first fetch key.

#### Hostel & Transport
| Menu Item | Endpoint | Params |
|-----------|----------|--------|
| Hostel Booking | `POST hostelregistrationinstruction.jsp` | `ids=31` |
| Room Details | `POST studentreportresources.jsp` | `ids=21` |
| Transport Registration | `POST transportregistrationinstructions.jsp` | `ids=51` |
| Registration Ack. | `POST transportconfirmationprint.jsp` | `ids=52` |

#### Other
| Menu Item | Endpoint | Params |
|-----------|----------|--------|
| Event Attendance | `POST eventattendance.jsp` | `ids=1` |
| SAP Process/Withdraw/Details/Attachments/Feedback | Various JSP | Various |
| End Semester Feedback | `POST subjectwisefeedback.jsp` | `ids=9` |
| Announcements | `POST announcements.jsp` | `ids=107, stuId=<dynamic>` |
| Mobile Verification | `POST mobilenumberverification.jsp` | `ids=1` |

### Feedback Governance Split
Official feedback is ERP-owned and limited to the end-semester automation flow:

| Product | Route namespace | Storage owner | Moderation |
|---------|-----------------|---------------|------------|
| Official course feedback | `/api/feedback/end-semester/*` | ERP session workflow | University ERP controls |
| Unofficial campus feedback | `/api/campus-feedback/*` | Platform SQLite store | Campus admin moderation queue |

Rules:
- Official course feedback is submitted only through `FeedbackAutomationService` and keeps using the authenticated ERP session.
- Events, hostel/mess, and transport feedback are API-backed platform submissions, not browser-local production data.
- Legacy browser-local unofficial feedback can be imported once through `/api/campus-feedback/:type/legacy-import`; imported entries enter the normal pending moderation queue.
- Unofficial entries store submitter identity internally for abuse prevention while the student-facing display can remain anonymous.
- Admin moderation requires an explicit approve/reject decision reason and writes an audit entry. It cannot mutate official ERP feedback.

---

## 5.5 HTML Response Parsing

### Input
ERP endpoints return `text/html;charset=UTF-8`. Typical structure:
```html
<div id="divContent">
  <h2>ATTENDANCE DETAILS</h2>
  <table>
    <thead><tr><th>Subject Code</th><th>...</th></tr></thead>
    <tbody>
      <tr><td>CSE 304</td><td>...</td></tr>
    </tbody>
  </table>
</div>
```

### Parsing Pipeline (`htmlParser.js`)
```
1. cheerio.load(html)
2. Select content root: #divContent or $.root()
3. Extract title from first <h1/h2/h3>
4. For each <table>:
   a. Extract headers from <thead> or first <tr>
   b. Deduplicate headers (append _N suffix)
   c. Extract body rows as { header: value } objects
   d. Filter empty rows
5. Extract profile TableContent (key:value pairs from first table)
6. Extract full text content (cleaned)
7. Build ErpDocument AST via erpDocumentBuilder
8. Return { title, text, tables, document, TableContent? }
```

### Output Shape
```json
{
  "title": "ATTENDANCE DETAILS",
  "text": "Attendance period: 2026-01-06 To ...",
  "tables": [
    [
      {
        "Subject Code": "CSE 304",
        "Subject Description": "Operating Systems",
        "ClassesConducted": "45",
        "Attendance\nEntered\n(Slots)": "42",
        "Attendance\n%": "93.33"
      }
    ]
  ],
  "document": {
    "title": "ATTENDANCE DETAILS",
    "root": {
      "id": "root_0",
      "type": "container",
      "props": {},
      "children": [
        { "id": "text_1", "type": "text", "props": { "content": "ATTENDANCE DETAILS" }, "children": [] },
        { "id": "table_2", "type": "table", "props": { "headers": [...], "rows": [...] }, "children": [] }
      ]
    }
  },
  "TableContent": { "Student Name": "...", "Register No.": "..." }
}
```

---

## 5.6 Scrape Target Mapping

The `scrapeTargets.js` config maps `pageKey` strings to arrays of `{ dropdown, subitem }` selectors:

```javascript
// Example: the dashboard fetches 4 ERP sections
dashboard: [
  { dropdown: "Academic", subitem: "Time Table" },
  { dropdown: "Academic", subitem: "Attendance Details" },
  { dropdown: "Examination", subitem: "Internal Mark Details" },
  { dropdown: "Announcements", subitem: "Announcements" },
]

// Example: attendance page fetches 3 ERP sections
"academic/attendance-details": [
  { dropdown: "Academic", subitem: "Attendance Details" },
  { dropdown: "Academic", subitem: "OD/ML Details" },
]
```

At runtime, each `{ dropdown, subitem }` is resolved via `DiscoveryRepository` to an actual HTTP endpoint, then fetched via `callEndpointViaApi()`.

---

## 5.7 Payload Validation

Before any ERP data is cached or returned, it passes through `validateLivePayload()`:

### Suspicious Text Detection
Patterns that indicate a login page leaked instead of real data:
```
/login with your application number/i
/ddmmyyyy/i
/welcome to srm university/i
/studentloginpage/i
/txt(username|authkey)/i
/captcha/i
/\$\s*\(/i          (jQuery)
/.fail\s*\(/i        (jQuery error handler)
```

### Payload Contracts
```javascript
getPayloadContract(pageKey) → {
  kind: "default" | "profile",
  requireTargetSections: boolean,    // Must contain expected dropdown→subitem sections
  rejectSuspiciousText: boolean,     // Reject if login page patterns detected
  minTableCount: number,             // Required number of data tables
  allowMeaningfulTextFallback: boolean // Allow text-only pages without tables
}
```

### Contract Overrides
- `profile` — Special validation (checks for expected profile fields)
- Table-required pages — Must have ≥1 table (attendance, timetable, marks, fees, etc.)
- Text-fallback pages — Can have meaningful text without tables (dashboard, SAP)

---

## 5.8 Dynamic Variables

Some ERP endpoints require user-specific parameters:
- `stuId` — Extracted from session's `profileData.TableContent["Student ID"]`
- `argId` — Used for semester-specific queries in Earlier Internal Marks

The system extracts `stuId` using `extractStudentId()` which searches profile data for patterns matching `/student\s*id/i` and extracts numeric values.

**Important:** The discovered data includes `stuId: "14688"` from the discovery account — this is NOT hardcoded for all users. It's replaced at runtime with the authenticated user's actual ID.
