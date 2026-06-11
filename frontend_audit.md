# Frontend Audit: University-ERP
Generated: 2026-05-30

---

## 1. Academic / ERP Core

### Routes & Pages

| Route | Component | File | Description |
|-------|-----------|------|-------------|
| `/` | HomePage | pages/Home/HomePage.tsx | Landing page with hero, value pillars |
| `/Home` | Navigate to / | baseRoutes.tsx | Redirect alias |
| `/login` | LoginPage | pages/Login/LoginPage.tsx | Captcha login form |
| `/forgot-password` | ForgotPasswordPage | pages/Login/ForgotPasswordPage.tsx | 3-step password reset |
| `/dashboard` | Dashboard | pages/Dashboard/Dashboard.tsx | Main dashboard (see widgets below) |
| `/profile` | ProfilePage | pages/Profile/ProfilePage.tsx | Personal/Academic/Contact cards |
| `/academic/timetable` | TimetablePage | pages/ERP/TimetablePage.tsx | Timetable display |
| `/academic/attendance-details` | AttendanceDetailsPage | pages/ERP/AttendanceDetailsPage.tsx | Attendance detail |
| `/academic/curriculum` | CurriculumPage | pages/ERP/CurriculumPage.tsx | Curriculum view |
| `/academic/sap-scholarships` | SapScholarshipsPage | pages/ERP/SapScholarshipsPage.tsx | SAP & scholarships |
| `/exams/current-semester-results` | ResultsCurrentPage | pages/ERP/ResultsCurrentPage.tsx | Current results |
| `/exams/earlier-semester-results` | ResultsEarlierPage | pages/ERP/ResultsEarlierPage.tsx | Earlier results |
| `/finance/fee-dues` | FeeDuesPage | pages/ERP/FeeDuesPage.tsx | Fee dues |
| `/finance/fee-paid` | FeePaidPage | pages/ERP/FeePaidPage.tsx | Fee paid |
| `/finance/bank-details` | BankDetailsPage | pages/ERP/BankDetailsPage.tsx | Bank details |
| `/transport-hostel/room-details` | RoomDetailsPage | pages/ERP/RoomDetailsPage.tsx | Room details |
| `/transport-hostel/faqs` | FaqsPage | pages/ERP/FaqsPage.tsx | Transport/hostel FAQs |
| `/transport-hostel/refund-change-requests` | RefundChangePage | pages/ERP/RefundChangePage.tsx | Refund/change |
| `/registration/*` (8 routes) | DocumentErpPage | pages/ERP/DocumentErpPage.tsx | Generic document renderer |
| `/feedback/course-feedback` | CourseFeedbackAssistantPage | pages/Feedback/ | Course feedback |
| `/notifications` | BlueprintPage | via blueprint | Announcements |
| `/settings` | BlueprintPage | via blueprint | Settings |
| `/resources/learning-materials` | LearningMaterialsPage | pages/Resources/ | Learning materials |
| `/resources/advanced-access` | LearningMaterialsPage | pages/Resources/ | Advanced access |

### Dashboard Widgets

| Widget | File | Description |
|--------|------|-------------|
| WelcomeCard | pages/Dashboard/WelcomeCard.tsx | Greeting + name + reg no + bell |
| BasicInfo | pages/Dashboard/BasicInfo.tsx | 12-field profile grid |
| QuickLinks | pages/Dashboard/QuickLinks.tsx | 7 shortcuts: Timetable, Attendance, Marks, Fee, LMS, Insights, Feedback |
| InternalMarks | pages/Dashboard/InternalMarks.tsx | Per-subject progress bars |
| Attendance | pages/Dashboard/Attendance.tsx | Recharts bar chart with 75% ref line |
| ToDo | pages/Dashboard/ToDo.tsx | Per-date task list (localStorage) |
| WeekCalendar | pages/Dashboard/WeekCalendar.tsx | Week-navigable date picker |
| Schedule | pages/Dashboard/Schedule.tsx | Day schedule from timetable |

Note: `Calendar.tsx` exists but is NOT used by Dashboard — `WeekCalendar.tsx` is the active widget.

### ERP Detail Pages (custom, from pages/ERP/)

AttendanceDetailsPage, TimetablePage, CurriculumPage, ResultsCurrentPage, ResultsEarlierPage, FeeDuesPage, FeePaidPage, BankDetailsPage, RoomDetailsPage, SapScholarshipsPage, FaqsPage, RefundChangePage, DocumentErpPage

Other pages: CourseFeedbackAssistantPage, LearningMaterialsPage, BlueprintPage (fallback)

### API Modules

`erpApi.ts` — ERP data wrapper
`erpTransformers.ts` — data transformers
`erpDisplayText.ts` — display helpers
`erpProfileCareer.ts` — profile/career transformers
`erpDocumentUtils.ts` — document utilities
`erp/` sub-module: types, schemas, registry, shared, attendanceTransformers, academicTransformers, financeTransformers, examTransformers, profileTransformers

---

## 2. Events & Competitions

### Routes & Pages (22 total)

| Route | Component | File |
|-------|-----------|------|
| `/events` | EventsListingPage | EventsListingPage.tsx |
| `/events/create` | CreateEventPage | CreateEventPage.tsx |
| `/events/my-activity` | MyActivityPage | MyActivityPage.tsx |
| `/events/my-teams` | MyTeamsPage | EventWorkflowPages.tsx |
| `/events/my-created` | MyCreatedEventsPage | MyCreatedEventsPage.tsx |
| `/events/notifications` | NotificationsPage | NotificationsPage.tsx |
| `/events/attendance` | EventAttendance | EventAttendance.tsx |
| `/events/:eventId` | EventDetailPageNew | EventDetailPageNew.tsx |
| `/events/:eventId/register` | RegistrationFlowPage | EventWorkflowPages.tsx |
| `/events/:eventId/teams/create` | TeamFormationPage | EventWorkflowPages.tsx |
| `/events/:eventId/teams/:teamId` | TeamDetailPage | EventWorkflowPages.tsx |
| `/events/:eventId/submit/:roundId` | SubmissionPage | SubmissionPage.tsx |
| `/events/:eventId/my-results/:roundId` | MyResultsPage | MyResultsPage.tsx |
| `/events/:eventId/leaderboard/:roundId` | LeaderboardPage | LeaderboardPage.tsx |
| `/events/:eventId/certificate/:roundId` | CertificateClaimPage | EventWorkflowPages.tsx |
| `/events/:eventId/manage` | OrganizerDashboard | OrganizerDashboard.tsx |
| `/events/:eventId/manage/roles` | RolesPage | EventWorkflowPages.tsx |
| `/events/:eventId/manage/certificate` | CertificateTemplatePage | EventWorkflowPages.tsx |
| `/events/:eventId/manage/rounds/:roundId/submissions` | SubmissionListPage | SubmissionListPage.tsx |
| `/events/:eventId/manage/rounds/:roundId/submissions/:submissionId/evaluate` | EvaluationPage | EvaluationPage.tsx |
| `/events/:eventId/manage/rounds/:roundId/shortlist` | ShortlistPage | ShortlistPage.tsx |

### Competition Components (23 total)

CompetitionPageShell, CompetitionCard, CompetitionEmptyPanel (CompetitionChrome.tsx)
RequireCompetitionAccess (CompetitionAccessGuard.tsx)
OrganizerGuard (OrganizerGuard.tsx)
CompetitionEventCard (CompetitionEventCard.tsx)
StatusBadge, DeadlineCountdown, DeadlinePassedBanner, RegistrationClosedBanner, SubmissionStatusBanner
RoundStatusCard, EvaluationCriteriaTable
AnnouncementComposer, AuditHistoryPanel, NotificationCenter, RegistrationsTable
ReviewHistory, JudgeNotes, SummaryStatBar, FileUploadZone, EmptyState, ErrorMessage, EventNotFound
SkeletonTable (re-export)

### Context

EventProvider (EventContext.tsx) — provides event, config, userState, myRole, loading, error, refetch. Smart polling (10s LIVE, 15s EVALUATION, 30s other). Caches with 60-120s TTL.

### API Modules

`campusApi.ts` — campus/events API
`competitionsApi.ts` — competitions API
`eventCache.ts` — in-memory event cache
`eventPhase.ts` — phase calculation
`eventUserState.ts` — user state for events

### EventsRegistrationHub (unused?)

Navigation hub page exists in code but is NOT in the route table. Contains 4 cards: explore events, my registrations, my submissions, organizer monitoring.

---

## 3. LMS (Learning Management System)

### Routes & Pages (24 total)

| Route | Component | File |
|-------|-----------|------|
| `/resources` | LmsHomePage | pages/LMS/LmsHomePage.tsx |
| `/resources/browse` | BrowsePage | pages/LMS/BrowsePage.tsx |
| `/resources/explore` | ExplorePage | pages/LMS/ExplorePage.tsx |
| `/resources/add` | AddResourcePage | pages/LMS/AddResourcePage.tsx |
| `/resources/contributors/:userId` | ContributorProfilePage | pages/LMS/me/ContributorProfilePage.tsx |
| `/resources/:id` | ResourceDetailPage | pages/LMS/ResourceDetailPage.tsx |
| `/resources/subject/:code` | SubjectOverviewPage | pages/LMS/SubjectOverviewPage.tsx |
| `/resources/subject/:code/pyq` | PYQBankPage | pages/LMS/PYQBankPage.tsx |
| `/resources/guides` | GuidesListPage | pages/LMS/guides/GuidesListPage.tsx |
| `/resources/guides/new` | GuideEditorPage | pages/LMS/guides/GuideEditorPage.tsx |
| `/resources/guides/:id` | GuideReaderPage | pages/LMS/guides/GuideReaderPage.tsx |
| `/resources/roadmaps` | RoadmapsListPage | pages/LMS/roadmaps/RoadmapsListPage.tsx |
| `/resources/roadmaps/new` | RoadmapBuilderPage | pages/LMS/roadmaps/RoadmapBuilderPage.tsx |
| `/resources/roadmaps/:id` | RoadmapViewerPage | pages/LMS/roadmaps/RoadmapViewerPage.tsx |
| `/resources/quiz/:id` | QuizModePage | pages/LMS/quiz/QuizModePage.tsx |
| `/resources/flashcards/:id` | FlashcardModePage | pages/LMS/quiz/FlashcardModePage.tsx |
| `/resources/question-bank` | QuestionBankPage | pages/LMS/QuestionBankPage.tsx |
| `/resources/requests` | RequestBoardPage | pages/LMS/RequestBoardPage.tsx |
| `/resources/me/contributions` | MyContributionsPage | pages/LMS/me/MyContributionsPage.tsx |
| `/resources/me/bookmarks` | SavedResourcesPage | pages/LMS/me/SavedResourcesPage.tsx |
| `/resources/me/collections` | CollectionsPage | pages/LMS/CollectionsPage.tsx |
| `/resources/me/progress` | ProgressPage | pages/LMS/me/ProgressPage.tsx |
| `/resources/me/revision` | RevisionQueuePage | pages/LMS/me/RevisionQueuePage.tsx |
| `/resources/me/exam-feedback` | ExamFeedbackPage | pages/LMS/me/ExamFeedbackPage.tsx |

### Academic Tracker Routes (3)

| Route | Component | File |
|-------|-----------|------|
| `/academic-tracker/progress-overview` | ProgressOverview | pages/AcademicTracker/ProgressOverview.tsx |
| `/academic-tracker/academic-insights` | AcademicInsights | pages/AcademicTracker/AcademicInsights.tsx |
| `/academic-tracker/unified-insights` | UnifiedInsights | pages/AcademicTracker/UnifiedInsights.tsx |

### LMS Components (22 total)

LmsFrame (LmsPageShared.tsx) — shared page shell
ResourceCard, ResourceGrid, ResourceFilterPanel
RecommendationSection
GuideSection
QuizRunner
FlipCard, InteractiveFlashcardDeck
RoadmapGraph
AnnotationPanel
ExamFeedbackCard, DuplicateWarning, OutdatedWarning, ExamProvenBadge, CurrentlyStudyingBadge, ReadingTimeChip, ValidityChip
WeeklyLeaderboard
TopicMasteryHeatmap
RequestCard

### API Modules

`resourcesApi.ts` — resource CRUD, catalog, collections, PYQ, recommendations, moderation
`communityApi.ts` — upvotes, bookmarks, flags, comments, annotations, requests
`quizApi.ts` — quiz attempts, exam feedback, question bank
`guidesApi.ts` — guides CRUD, sections, read tracking
`roadmapsApi.ts` — roadmaps CRUD, DAG nodes/edges
`progressApi.ts` — progress, insights, mastery, streak, revision, leaderboard
`types.ts` — all TypeScript types
`fixtures.ts` — static prototype fixtures
`http.ts` — HTTP helpers

---

## 4. Career Portal

### Routes & Pages (12 student + 3 admin)

| Route | Component | File |
|-------|-----------|------|
| `/career` | CareerHomePage | pages/CareerPortal/CareerHomePage.tsx |
| `/career/opportunities` | OpportunitiesPage | pages/CareerPortal/OpportunitiesPage.tsx |
| `/career/opportunities/:id` | OpportunityDetailPage | pages/CareerPortal/OpportunityDetailPage.tsx |
| `/career/jobs` | OpportunitiesPage (filtered) | pages/CareerPortal/OpportunitiesPage.tsx |
| `/career/internships` | OpportunitiesPage (filtered) | pages/CareerPortal/OpportunitiesPage.tsx |
| `/career/hackathons` | OpportunitiesPage (filtered) | pages/CareerPortal/OpportunitiesPage.tsx |
| `/career/competitions` | OpportunitiesPage (filtered) | pages/CareerPortal/OpportunitiesPage.tsx |
| `/career/me/bookmarks` | BookmarksPage | pages/CareerPortal/BookmarksPage.tsx |
| `/career/me/profile` | CareerProfilePage | pages/CareerPortal/CareerProfilePage.tsx |
| `/career/me/skill-gap` | SkillGapPage | pages/CareerPortal/SkillGapPage.tsx |
| `/career/me/tracker` | ApplicationTrackerPage | pages/CareerPortal/ApplicationTrackerPage.tsx |
| `/career/submit` | SubmitOpportunityPage | pages/CareerPortal/SubmitOpportunityPage.tsx |

Admin variants: AdminCareerOpportunitiesPage, AdminCareerInterviewsPage, AdminCareerAlumniPage

### Career Components (7)

OpportunityCard, DeadlineCountdown, EligibilityBadge, ModeChip, SourceBadge, StipendChip, TypeBadge

### API Module

`careerApi.ts` — 39 functions covering all career endpoints

### Orphaned Component

`ResumeProfile.tsx` (pages/CareerPortal/) — exists but has NO route, NO imports. Dead code.

---

## 5. Helpdesk & Feedback

### Routes & Pages (7)

| Route | Component | File |
|-------|-----------|------|
| `/helpdesk/raise-ticket` | RaiseTicket | pages/Helpdesk/RaiseTicket.tsx |
| `/helpdesk/faqs` | HelpdeskFAQs (FAQs) | pages/Helpdesk/FAQs.tsx |
| `/helpdesk/track-escalate` | TrackEscalate | pages/Helpdesk/TrackEscalate.tsx |
| `/feedback/course-feedback` | CourseFeedbackAssistantPage | pages/Feedback/CourseFeedbackAssistantPage.tsx |
| `/feedback/events-feedback` | EventsFeedback | pages/Feedback/EventsFeedback.tsx |
| `/feedback/hostel-mess-feedback` | HostelMessFeedback | pages/Feedback/HostelMessFeedback.tsx |
| `/feedback/transport-feedback` | TransportFeedback | pages/Feedback/TransportFeedback.tsx |

### Shared Base Component

`CampusFeedbackPage` (pages/Feedback/CampusFeedbackPage.tsx) — used by EventsFeedback, HostelMessFeedback, TransportFeedback. NOT a route itself. Provides governance banner, admin option management, star-rating form, submission history with moderation status.

### API Modules

`campusFeedbackApi.ts` — campus feedback API calls
`studentToolsApi.ts` — student tools

---

## 6. Admin

### Routes & Pages (15)

| Route | Component | File |
|-------|-----------|------|
| `/admin/events-management` | AdminEventsManagementPage | pages/Admin/AdminEventsManagementPage.tsx |
| `/admin/events-management/:eventId` | AdminEventDetailPage | pages/Admin/AdminEventDetailPage.tsx |
| `/admin/event-approvals` | AdminEventApprovalsPage | pages/Admin/AdminEventApprovalsPage.tsx |
| `/admin/content-management` | AdminContentManagementPage | pages/Admin/AdminContentManagementPage.tsx |
| `/admin/campus-feedback` | AdminCampusFeedbackPage | pages/Admin/AdminCampusFeedbackPage.tsx |
| `/admin/lms-moderation` | AdminLmsModerationPage | pages/Admin/AdminLmsModerationPage.tsx |
| `/admin/system-controls` | AdminSystemControlsPage | pages/Admin/AdminSystemControlsPage.tsx |
| `/admin/helpdesk-tickets` | AdminHelpdeskTicketsPage | pages/Admin/AdminHelpdeskTicketsPage.tsx |
| `/admin/helpdesk-faqs` | AdminHelpdeskFaqsPage | pages/Admin/AdminHelpdeskFaqsPage.tsx |
| `/admin/career-opportunities` | AdminCareerOpportunitiesPage | pages/Admin/AdminCareerOpportunitiesPage.tsx |
| `/admin/career-interviews` | AdminCareerInterviewsPage | pages/Admin/AdminCareerInterviewsPage.tsx |
| `/admin/career-alumni` | AdminCareerAlumniPage | pages/Admin/AdminCareerAlumniPage.tsx |
| `/admin/department-performance` | AdminDeptPerformancePage | pages/Admin/AdminDeptPerformancePage.tsx |
| `/admin/audit-logs` | AdminAuditLogsPage | pages/Admin/AdminAuditLogsPage.tsx |
| `/admin/certificate-templates` | AdminCertTemplatesPage | pages/Admin/AdminCertTemplatesPage.tsx |

### Admin Components

AdminAccessPrompt — full-screen modal overlay for admin password
AdminAccessPanel — inline panel for unlock/lock

### Context & Guards

AdminModeProvider / useAdminMode (AdminModeContext.tsx) — potentialAdmin, isAdmin, registerNo, showPrompt, busy, error, unlock(), disable(), skipPrompt(), openPrompt(). Persists prompt dismissal to sessionStorage.
AdminOnlyPage — route guard: redirects to /dashboard if !isAdmin
ProtectedPage — outer auth guard (login check)

---

## 7. App Shell & Navigation

### Layout Components

| Component | File | Description |
|-----------|------|-------------|
| PageLayout | pages/PageLayout.tsx | App shell: Header/Sidebar/Footer/AppContentChrome/CommandPalette |
| ProtectedPage | components/ProtectedPage.tsx | Auth guard wrapper |
| AdminOnlyPage | components/AdminOnlyPage.tsx | Admin guard wrapper |
| AppContentChrome | components/shell/AppContentChrome.tsx | Breadcrumbs + Suspense |
| BreadcrumbsBar | components/shell/BreadcrumbsBar.tsx | Breadcrumb trail |

### Navigation

**Sidebar** (components/Sidebar.tsx) — collapsible left rail (w-64 / w-16). Auto-collapses below 900px. Sections from getMainNavSections(). Each section has link items and group items (expandable accordions). Basic/Advanced toggle at bottom filters by access level. Bottom nav shows Notifications, Settings, Logout. Admin mode button/badge in footer.

**Header** (components/Header.tsx) — used for public routes (Home, Login). Logo + auth-aware nav buttons.

**Command Palette** (components/NavigationCommandPalette.tsx) — Ctrl+K / Cmd+K. Indexes all routes from getRouteCatalog(). Grouped by category. Admin routes filtered by isAdmin.

**Keyboard Shortcuts** (components/AppKeyboardShortcuts.tsx) — g+d (dashboard), g+h (LMS), g+c (career), g+e (events). Disabled while typing.

**Footer** (components/Footer.tsx) — public route layout only.

### Navigation Data Model

- `MAIN_NAV` (navigation.ts) — 4 sections: ERP CORE, COMPETITION PLATFORM, LEARNING MANAGEMENT, CAREER SERVICES (+ ADMINISTRATION when admin)
- `BOTTOM_NAV` — Notifications, Settings, Logout
- `DASHBOARD_QUICK_LINKS` — 7 dashboard cards
- `SUPPLEMENTAL_ROUTE_CATALOG` — additional routes for command palette
- `NAV_HIDDEN_ROUTES` — 4 routes hidden from both sidebar and palette: /exams/essentials, /transport-hostel/outing-maintenance, /registration/registration-tracker, /registration/events-registration

### Blueprint Registry

| File | Contents |
|------|----------|
| coreBlueprints.ts | 26 ERP core blueprints (dashboard, academics, exams, finance, transport-hostel, registration) |
| eventBlueprints.ts | 21 event/competition blueprints |
| workspaceBlueprints.ts | LMS, career, academic-tracker, helpdesk, admin, profile, settings, notifications (~50 blueprints) |
| navigation.ts | MAIN_NAV, BOTTOM_NAV, DASHBOARD_QUICK_LINKS, getMainNavSections, getSidebarNav |

### Shared / UI Components

| Category | Components |
|----------|-----------|
| UI primitives | AnimatedCounter, AsyncState, Breadcrumb, DataTable, EmptyState, FilterBar, FileUploadZone, FormSection, InlineError, InputGroup, PageHeader, Pagination, ProgressBar, RadialProgress, SectionCard, SkeletonBlock, SkeletonCard, SkeletonTable, SplitLayout, StarRating, StatCard, StatusBadge, Tabs, Tag, Toast |
| Shell | AppContentChrome, BreadcrumbsBar, DataTable |
| Layout | PageLayouts (DashboardLayout) |
| Forms | FormField |
| shadcn/ui | button, select, textarea, command, dialog |
| Data | DataToolbar, RowActionButton |

### Contexts

AdminModeContext — admin mode state
EventContext — event data + polling + user state

### Hooks

useAdminAccess, useIntersectionObserver, useOptimistic, usePageContrast, useSession

### Routing Architecture

Routes assembled in routes/index.tsx via createBrowserRouter:
- baseRoutes — public (/, /login, /forgot-password) + protected (/dashboard, /profile)
- eventRoutes — all /events/* wrapped in ProtectedPage
- lmsRoutes — all /resources/* wrapped in ProtectedPage
- erpRoutes — auto-generated from PAGE_BLUEPRINTS, wrapped in ProtectedPage or AdminOnlyPage
- adminRoutes — additional admin routes
- catch-all /* → redirect to /

### Styles Architecture

src/styles/index.css imports: base.css, layout.css, components.css, erp.css, lms.css, events.css, events/*.css

---

## 8. Orphaned / Dead Code

| File | Status |
|------|--------|
| pages/CareerPortal/ResumeProfile.tsx | NEVER imported, no route, dead code |
| pages/Dashboard/Calendar.tsx | EXISTS but NOT used in Dashboard (WeekCalendar used instead) |
| pages/Events/EventsRegistrationHub.tsx | EXISTS but NOT in route table (test file exists too) |
| components/ui/DataTable.tsx | Potentially unused (shell/DataTable.tsx exists separately) |
