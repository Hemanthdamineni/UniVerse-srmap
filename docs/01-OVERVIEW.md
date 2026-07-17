# 01 — Project Overview

## 1.1 Vision

The **University ERP Companion Platform** is a student-facing middleware that wraps the legacy SRM AP University ERP (`student.srmap.edu.in`). The ERP is a traditional JSP/HTML application with poor UX, no API, and no mobile-friendly interface. This platform:

1. **Proxies** ERP data through a modern backend, converting raw HTML into structured JSON.
2. **Presents** that data through a polished React SPA with dark mode, responsive layout, and command palette navigation.
3. **Enhances** the ERP with features it doesn't provide: events management, content/resources, academic trackers, career portal, and helpdesk.

Students authenticate once and see all ERP data (attendance, timetable, marks, fees) alongside platform-native features — all through a single interface.

---

## 1.2 Target Users

| User Type | Access Level | Features |
|-----------|-------------|----------|
| **Students** | Primary user | All ERP data views, event registration, resource access, notifications |
| **Event Organizers** | Elevated | Event creation, attendee management, CSV export, bulk messaging |
| **Content Admins** | Admin | Content CRUD, resource management (password-protected) |
| **System Operators** | Infra | Health checks, metrics, deployment, monitoring |

---

## 1.3 Feature Summary

### ERP Integration Features (data sourced from university ERP)

| Feature | Route | Renderer |
|---------|-------|----------|
| Dashboard | `/dashboard` | `dashboard` — batch-fetches timetable, attendance, marks, announcements |
| Time Table | `/academic/timetable` | `timetable` — weekly grid + subject legend |
| Attendance Details | `/academic/attendance-details` | `attendance` — per-subject stats with OD/ML |
| Curriculum | `/academic/curriculum` | `curriculum` — semester-wise subject list |
| SAP & Scholarships | `/academic/sap-scholarships` | `generic` |
| Current Semester Results | `/exams/current-semester-results` | `results-current` |
| Earlier Semester Results | `/exams/earlier-semester-results` | `results-earlier` |
| Fee Dues | `/finance/fee-dues` | `finance-dues` |
| Fee Paid | `/finance/fee-paid` | `finance-paid` |
| Bank Details | `/finance/bank-details` | `generic` |
| Room Details | `/transport-hostel/room-details` | `generic` |
| Exam Registration | `/registration/exam-registration` | `generic` |
| Course Registration | `/registration/course-registration` | `generic` |
| Notifications / Announcements | `/notifications` | `announcements` |
| Profile | `/profile` | `profile` |
| Settings | `/settings` | `generic` |

### Platform-Native Features (independent of ERP)

| Feature | Route | Status |
|---------|-------|--------|
| Events System | `/events/*` | ✅ Full CRUD, registration, check-in, feedback, iCal, CSV export |
| Content / Resources | `/resources/*` | ✅ Admin-managed content store (SQLite) |
| Academic Tracker | `/academic-tracker/*` | ✅ Progress overview, academic insights, unified insights |
| Career Portal | `/career-portal/*` | ✅ Full CRUD with resume parsing, matching, skill gap, public profile |
| LMS | `/lms/*` | ✅ Full resource/guide/roadmap/quiz/PYQ system |
| Helpdesk | `/helpdesk/*` | ✅ Ticket CRUD, FAQs, escalation workflow |
| Feedback | `/feedback/*` | ⚠️ Partial — course feedback via ERP, others external |

---

## 1.4 Technology Stack

### Backend
| Technology | Purpose | Version |
|------------|---------|---------|
| **Node.js** | Runtime | — |
| **Express 5** | HTTP framework | `^5.1.0` |
| **Playwright** | ERP HTTP request client (session/cookie management) | `^1.55.0` |
| **Cheerio** | Server-side HTML parsing (ERP response extraction) | `^1.1.2` |
| **Redis** | Session store, ERP cache, rate limiting, circuit breaker, distributed locks | `^5.8.2` |
| **SQLite** (built-in `node:sqlite`/better-sqlite3) | Application data — content, events, external pages | embedded |
| **prom-client** | Prometheus metrics | `^15.1.3` |
| **helmet** | Security headers | `^8.1.0` |
| **express-rate-limit** | Rate limiting (fallback) | `^8.1.0` |

### Frontend
| Technology | Purpose | Version |
|------------|---------|---------|
| **React 19** | UI framework | `^19.1.0` |
| **Vite 7** | Build tool / dev server | `^7.0.4` |
| **TypeScript** | Type safety | `~5.8.3` |
| **TailwindCSS 4** | Utility-first CSS | `^4.1.11` |
| **React Router 7** | Client-side routing | `^7.7.0` |
| **Recharts** | Charts / visualizations | `^2.15.4` |
| **Radix UI** | Headless primitives (Dialog, Popover) | various |
| **shadcn/ui** | Pre-built components (Button, Card, Calendar, Command) | `^2.9.3` |
| **Lucide React** | Icon library | `^0.542.0` |
| **date-fns** | Date utilities | `^4.1.0` |
| **Axios** | HTTP client (legacy; `fetch` used for ERP API calls) | `^1.10.0` |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **Docker + Compose** | Containerized deployment |
| **Nginx** | Reverse proxy, static file serving, TLS termination |
| **Prometheus + Grafana** | Optional monitoring stack |
| **Loki + Promtail** | Optional log aggregation |

---

## 1.5 Design Principles

1. **ERP is backend-only.** The frontend never communicates with the ERP directly.
2. **Schema-driven rendering.** ERP pages are rendered by reusable schema blocks (`table`, `form`, `card`, etc.), not hardcoded page components per ERP endpoint.
3. **Blueprint-driven routing.** A single `PAGE_BLUEPRINTS` config drives all route creation, data fetching, and renderer selection.
4. **Cache-first by default.** Most ERP data is served from Redis cache with background refresh, leading to sub-100ms response times for cached data.
5. **Graceful degradation.** If Redis is down, the system falls back to in-memory stores. If the ERP is down, stale cache is served. If a transformer fails, partial validated data is still rendered.
6. **Pipeline-guarded data.** All ERP data passes through a transformer → schema validator pipeline before reaching the UI, preventing `[object Object]` leakage.
7. **Feature flags.** Major behaviors (cache-first, auth cookie mode, distributed locking, error envelopes, V2 API) are individually togglable via environment variables.
