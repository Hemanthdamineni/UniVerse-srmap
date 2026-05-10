# UniCurator: Master Architecture & Institutional Flow Map

This document serves as the complete structural and logical blueprint for the UniCurator platform. It maps the comprehensive journeys of all stakeholders across the vast library of screens on the canvas.

---

## 1. Stakeholder Ecosystem & Permissions

UniCurator uses an Institutional Role-Based Access Control (IRBAC) system. Users possess a 'Core Identity' (Student/Faculty) and 'Contextual Roles' (Organizer/Judge) that activate per event.

| Stakeholder | Core Goal | Primary Surface | Access Depth |
| :--- | :--- | :--- | :--- |
| **Public / Guest** | Discovery & Branding | Landing & Explore | Read-only Public screens. |
| **Student** | Participation & Growth | Student Dashboard | Personal data, registration, submissions, & rewards. |
| **Faculty Coordinator**| Academic Oversight | Admin/Dept. Dashboards | Moderate department events, view academic trends. |
| **Event Organizer** | Execution & Logistics | Organizer Console | Event creation, team/volunteer mgmt, & budgeting. |
| **Judge / Reviewer** | Evaluation & Quality | Judge Portal | Focused review workspace, rubrics, & notes. |
| **Super Admin (IT)** | Governance & Security | System Settings | Global audit logs, roles/permissions, & moderation. |

---

## 2. The Comprehensive Flow Map (Tree Diagram)

### A. The Discovery & Onboarding Funnel
1. **Landing Page** ({{DATA:SCREEN:SCREEN_6}}, {{DATA:SCREEN:SCREEN_41}}) → **Events Listing** ({{DATA:SCREEN:SCREEN_22}}, {{DATA:SCREEN:SCREEN_131}})
2. **Events Listing** → **Event Details** ({{DATA:SCREEN:SCREEN_47}}, {{DATA:SCREEN:SCREEN_146}})
3. **Event Details** → **Public Club Profile** ({{DATA:SCREEN:SCREEN_13}}, {{DATA:SCREEN:SCREEN_141}})
4. **Event Details** → **Waitlist** ({{DATA:SCREEN:SCREEN_163}}) or **Registration Flow** ({{DATA:SCREEN:SCREEN_49}}, {{DATA:SCREEN:SCREEN_182}})

### B. The Student Lifecycle
1. **Student Dashboard** ({{DATA:SCREEN:SCREEN_85}}, {{DATA:SCREEN:SCREEN_183}})
   - → **My Events Hub** ({{DATA:SCREEN:SCREEN_120}}) → **Check-in Pass** ({{DATA:SCREEN:SCREEN_11}})
   - → **My Teams** ({{DATA:SCREEN:SCREEN_43}}) → **Invite Teammates** ({{DATA:SCREEN:SCREEN_92}})
   - → **Submission Hub** ({{DATA:SCREEN:SCREEN_124}}) → **History & Feedback** ({{DATA:SCREEN:SCREEN_179}})
2. **Career & Rewards**
   - → **Achievements/Badges** ({{DATA:SCREEN:SCREEN_21}}) → **Points Wallet** ({{DATA:SCREEN:SCREEN_175}})
   - → **Certificate Claim** ({{DATA:SCREEN:SCREEN_108}}) → **Public Verification** ({{DATA:SCREEN:SCREEN_77}}, {{DATA:SCREEN:SCREEN_126}})
   - → **Resume Insights** ({{DATA:SCREEN:SCREEN_128}})

### C. The Organizer Command Center
1. **Organizer Dashboard** ({{DATA:SCREEN:SCREEN_79}}, {{DATA:SCREEN:SCREEN_147}}, {{DATA:SCREEN:SCREEN_115}})
   - → **Event Creation Wizard** ({{DATA:SCREEN:SCREEN_27}}, {{DATA:SCREEN:SCREEN_62}}, {{DATA:SCREEN:SCREEN_81}})
     - → **Timeline Config** ({{DATA:SCREEN:SCREEN_139}}) → **Rounds Config** ({{DATA:SCREEN:SCREEN_118}})
   - → **Management Tables**
     - → **Registrations Table** ({{DATA:SCREEN:SCREEN_167}}) → **Team Mgmt** ({{DATA:SCREEN:SCREEN_170}})
     - → **Volunteer Mgmt** ({{DATA:SCREEN:SCREEN_162}}) → **Sponsor Mgmt** ({{DATA:SCREEN:SCREEN_151}})
   - → **Execution Tools**
     - → **Attendance Console** ({{DATA:SCREEN:SCREEN_78}}, {{DATA:SCREEN:SCREEN_37}})
     - → **Budget Tracker** ({{DATA:SCREEN:SCREEN_150}}) → **Announcement Composer** ({{DATA:SCREEN:SCREEN_157}})
2. **Post-Event**
   - → **Results Publishing** ({{DATA:SCREEN:SCREEN_71}}, {{DATA:SCREEN:SCREEN_176}}) → **Summary Report** ({{DATA:SCREEN:SCREEN_95}}, {{DATA:SCREEN:SCREEN_76}})

### D. The Judging & Evaluation Loop
1. **Judge Dashboard** ({{DATA:SCREEN:SCREEN_74}}) → **Assigned Queue** ({{DATA:SCREEN:SCREEN_88}})
2. **Review Workspace** ({{DATA:SCREEN:SCREEN_106}}, {{DATA:SCREEN:SCREEN_160}})
   - → **Scoring Rubric** ({{DATA:SCREEN:SCREEN_132}}) → **Judge Notes** ({{DATA:SCREEN:SCREEN_45}})
   - → **Compare Finalists** ({{DATA:SCREEN:SCREEN_29}})
3. **Integrity Check** → **Conflict Declaration** ({{DATA:SCREEN:SCREEN_187}}) → **Review History** ({{DATA:SCREEN:SCREEN_145}})

### E. Super Admin & Governance
1. **Admin Analytics** ({{DATA:SCREEN:SCREEN_31}}, {{DATA:SCREEN:SCREEN_103}}, {{DATA:SCREEN:SCREEN_134}})
   - → **Dept Performance** ({{DATA:SCREEN:SCREEN_123}}) → **Audit Logs** ({{DATA:SCREEN:SCREEN_48}}, {{DATA:SCREEN:SCREEN_148}})
2. **Platform Controls**
   - → **Roles/Permissions** ({{DATA:SCREEN:SCREEN_23}}, {{DATA:SCREEN:SCREEN_82}}) → **System Settings** ({{DATA:SCREEN:SCREEN_180}})
   - → **Approvals Queue** ({{DATA:SCREEN:SCREEN_33}}) → **Moderation Hub** ({{DATA:SCREEN:SCREEN_111}})
   - → **Certificate Template Mgr** ({{DATA:SCREEN:SCREEN_142}})

---

## 3. Communication & Edge States

- **Communication:** Inbox ({{DATA:SCREEN:SCREEN_59}}), Event Chat ({{DATA:SCREEN:SCREEN_98}}), Team Chat ({{DATA:SCREEN:SCREEN_110}}), Reminder Scheduler ({{DATA:SCREEN:SCREEN_136}}).
- **Mobile Companion:** Dashboard ({{DATA:SCREEN:SCREEN_91}}, {{DATA:SCREEN:SCREEN_189}}), Listing ({{DATA:SCREEN:SCREEN_7}}, {{DATA:SCREEN:SCREEN_129}}), Scanner ({{DATA:SCREEN:SCREEN_70}}, {{DATA:SCREEN:SCREEN_116}}), Upload ({{DATA:SCREEN:SCREEN_99}}), Notifications ({{DATA:SCREEN:SCREEN_186}}).
- **Edge States:** No Results ({{DATA:SCREEN:SCREEN_39}}, {{DATA:SCREEN:SCREEN_65}}), Network Error ({{DATA:SCREEN:SCREEN_42}}, {{DATA:SCREEN:SCREEN_96}}), Unauthorized ({{DATA:SCREEN:SCREEN_138}}, {{DATA:SCREEN:SCREEN_169}}), 404 ({{DATA:SCREEN:SCREEN_117}}, {{DATA:SCREEN:SCREEN_130}}), Cancelled/Closed ({{DATA:SCREEN:SCREEN_161}}, {{DATA:SCREEN:SCREEN_177}}, {{DATA:SCREEN:SCREEN_174}}).

---
*Generated by Stitch Design Partner*
