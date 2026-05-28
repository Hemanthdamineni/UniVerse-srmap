# UniCurator: Implementation & Consolidation Plan

This document outlines the strategy for moving from the current collection of over 100 screens to a finalized, implementation-ready design suite.

## 1. Screen Audit & Selection (The "Golden" Set)
Given the multiple iterations, we will standardize on the following "Golden" versions of the core screens to ensure consistency in density, spacing, and component usage:

### A. Discovery & Public
*   **Landing Page:** {{DATA:SCREEN:SCREEN_6}} (Premium SaaS feel)
*   **Events Listing:** {{DATA:SCREEN:SCREEN_132}} (High-density grid)
*   **Event Details:** {{DATA:SCREEN:SCREEN_147}} (Most comprehensive info)
*   **Calendar View:** {{DATA:SCREEN:SCREEN_69}}

### B. Student Experience
*   **Dashboard:** {{DATA:SCREEN:SCREEN_136}} (Updated KPI layout)
*   **My Events Hub:** {{DATA:SCREEN:SCREEN_121}}
*   **Registration & Team Setup:** {{DATA:SCREEN:SCREEN_184}} (Final multi-step flow)
*   **Submission & Leaderboard:** {{DATA:SCREEN:SCREEN_125}}
*   **Certificate Claim:** {{DATA:SCREEN:SCREEN_109}}

### C. Organizer Command Center
*   **Dashboard:** {{DATA:SCREEN:SCREEN_116}} (Optimized KPI spacing)
*   **Create Event Wizard:** {{DATA:SCREEN:SCREEN_140}} (Timeline) & {{DATA:SCREEN:SCREEN_119}} (Rounds)
*   **Registrations Management:** {{DATA:SCREEN:SCREEN_169}}
*   **Attendance Console:** {{DATA:SCREEN:SCREEN_79}}
*   **Submission Review Queue:** {{DATA:SCREEN:SCREEN_138}}

### D. Judge Portal
*   **Dashboard:** {{DATA:SCREEN:SCREEN_75}}
*   **Assigned Queue:** {{DATA:SCREEN:SCREEN_89}}
*   **Evaluation Workspace:** {{DATA:SCREEN:SCREEN_162}} (Optimized layout)
*   **Scoring Rubric:** {{DATA:SCREEN:SCREEN_133}}

### E. Admin & Governance
*   **Global Analytics:** {{DATA:SCREEN:SCREEN_135}}
*   **System Audit Log:** {{DATA:SCREEN:SCREEN_149}}
*   **Roles & Permissions:** {{DATA:SCREEN:SCREEN_182}} (System settings)

---

## 2. Connective Tissue & Navigation Refinement
To bridge the remaining gaps, I will perform the following actions:

1.  **Sidebar Standardization:** Ensure the primary navigation sidebar across all selected screens has perfectly matching links and icons for its specific role.
2.  **Breadcrumb Implementation:** Add consistent breadcrumb navigation to deep-level pages (e.g., Evaluation -> Submission Review) for better user orientation.
3.  **Cross-Role Transitions:** Design the "Role Switcher" UI for the profile menu, allowing users (like a Student who is also an Organizer) to move between contexts instantly.

---

## 3. Implementation Checklist for Development
*   **Theming:** Export tokens from {{DATA:DESIGN_SYSTEM:DESIGN_SYSTEM_1}} (Teal/Slate/White).
*   **Common Components:** Standardize the 'UniCurator' KPI card and Data Table components.
*   **Responsive Breakpoints:** Use the Mobile screens ({{DATA:SCREEN:SCREEN_130}}, {{DATA:SCREEN:SCREEN_191}}, {{DATA:SCREEN:SCREEN_117}}) as the primary reference for the 375px breakpoint.

---
*Plan created by Stitch Design Partner*