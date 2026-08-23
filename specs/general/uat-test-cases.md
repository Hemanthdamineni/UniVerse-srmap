# UAT Test Cases: Full Site Static Prototype

**Feature**: End-to-end full site coverage (Static Prototype Mode)
**Branch**: `main`
**Date**: 2026-07-30
**Tester**: Claude Code (automated via Playwright MCP)
**Environment**: Local (`npm run dev` with `VITE_STATIC_PROTOTYPE=true`)

## Prerequisites

1. **Start local dev server**: `npm run dev` in `Frontend/` with `VITE_STATIC_PROTOTYPE=true` in `.env.local`
2. **Authenticate**: Automatic session bootstrapping takes place when `VITE_STATIC_PROTOTYPE=true`, loading the `STATIC_PROTOTYPE_PROFILE`.

## Test Cases

### TC-01: Core Navigation and App Shell (Critical)

**User Story**: As a student, I need to open the app, be automatically authenticated in the prototype, and navigate through the side menu to major sections.
**Priority**: Critical

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `http://localhost:5173/` | The app loads, automatically boots a mock session, and redirects to Dashboard if auth is present, or shows the Dashboard. |
| 2 | Check the Sidebar for "Dashboard" and click it | Title shows "Dashboard" or main hub view renders |
| 3 | Check the Sidebar for "Career" and click it | Navigates to `/career`, shows Career Opportunities or Career Hub |
| 4 | Reload the page | The current page reloads successfully without losing session data |

**Pass criteria**: The application loads and navigation between major sections via sidebar works without 404s.

### TC-02: Career Portal (High)

**User Story**: As a student, I want to explore job opportunities and view a specific opportunity.
**Priority**: High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/career` | The Career Portal home/overview is visible |
| 2 | Click on "Opportunities" (or Jobs/Internships) | Navigates to `/career/opportunities` |
| 3 | Verify opportunity cards are rendered | Multiple UI cards representing jobs/internships are visible |

**Pass criteria**: The Career portal sections load and display mock data properly.

### TC-03: Learning Management System (High)

**User Story**: As a student, I want to browse study materials.
**Priority**: High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/resources` | The LMS Portal home page loads |
| 2 | Verify categories/resources are visible | There are resource cards or subject groupings |
| 3 | Click on "Browse" or a specific subject | Navigates to corresponding browse page or subject list |

**Pass criteria**: The LMS landing page loads correctly.

### TC-04: ERP Core Features (High)

**User Story**: As a student, I want to see my attendance or timetable.
**Priority**: High

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/attendance` (or click Attendance in Sidebar) | Attendance UI is rendered (even if using dummy data) |
| 2 | Navigate to `/timetable` (or click Timetable in Sidebar) | Timetable layout is rendered |

**Pass criteria**: ERP specialized components render without React errors.

### TC-05: 404 Error Handling (Medium)

**User Story**: As a user, if I type a wrong URL, I should see a Not Found page.
**Priority**: Medium

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/non-existent-page-12345` | Error boundary or 404 fallback page is shown ("Page not found") |

**Pass criteria**: A polite error/404 message is displayed rather than a blank screen.