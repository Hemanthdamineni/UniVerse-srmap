# Companion Platform Implementation Root Cause Analysis

> Date: 2026-06-16  
> Scope: LMS, Career, Events, cross-domain profile, personalization, matching, tests, and deployment readiness

## Purpose

This report turns the previous implementation cycle's issues into an explicit engineering checklist for the new end-to-end build. The prior cycle produced useful domain primitives, but the platform still lacked a cohesive student outcomes system. The failure mode was not one broken function; it was a collection of product, architecture, integration, testing, and rollout oversights.

## Root Causes and Pitfalls

| Area | What Went Wrong | Root Cause | New Guardrail |
|---|---|---|---|
| Product scope | LMS, Career, and Events grew as separate feature islands | Domain plans were implemented independently without a shared student-value loop | Every feature must declare the cross-domain signal it emits or consumes |
| Adoption value | Features existed but did not clearly beat shared drives, LinkedIn, job boards, or club channels | Success criteria focused on capability presence instead of student behavior | Prioritize exam prep, opportunity fit, team formation, and verified achievements before breadth |
| Unified profile | "Unified insights" existed inside LMS tracking, but no first-class profile, privacy, or signal ledger existed | Cross-domain aggregation was embedded in one domain service | Add shared profile, signal, achievement, skill, privacy, and recommendation services |
| Recommendation design | Recommendations were domain-local and inconsistently explainable | No shared scoring contract or feedback loop | All recommenders return score, label, reasons, risks, missing data, and feedback tracking |
| Career profile | Resume/profile features were shallow and not strongly tied to fit scoring or readiness | Profile was treated as static data entry | Add profile quality, resume versions, fit scoring, and readiness snapshots incrementally |
| LMS quality | Resources could be discovered, but quality, exam relevance, and freshness were not central enough | Repository mechanics outran trust mechanics | Resource ranking must include quality, exam-proven score, freshness, moderation, and contributor trust |
| Events value | Event management worked better than student participation loops | Organizer workflow received more attention than student repeat engagement | Add personalized feed, team discovery, achievement sync, and post-event learning/career actions |
| Privacy | Inferred data and achievements lacked a consistent visibility model | Privacy was deferred until after integration | Default inferred signals to private or personalization-only and enforce visibility server-side |
| Testing | Tests covered slices but not cross-domain invariants | Regression coverage followed modules rather than outcomes | Add regression tests for profile aggregation, recommendations, privacy, achievements, and route contracts |
| Deployment readiness | Production validation was described but not tied to automated gates | Operational checklist was separate from implementation | Add post-implementation verification report and explicit deployment gates |

## Non-Repeat Checklist

- [ ] Do not add domain features without a signal, profile, recommendation, or achievement integration path.
- [ ] Do not expose inferred skills, readiness, resume data, or achievements publicly by default.
- [ ] Do not ship recommendation endpoints without explainability fields and feedback capture.
- [ ] Do not claim LMS improvement unless PYQ/exam prep, quality ranking, and revision paths are covered.
- [ ] Do not claim Career maturity unless profile quality, resume intelligence, fit scoring, and skill gaps are connected.
- [ ] Do not claim Events maturity unless discovery, team formation, achievements, and organizer analytics are covered.
- [ ] Do not treat tests as sufficient unless they verify cross-domain behavior, not only route existence.
- [ ] Do not rely on live ERP availability for companion-domain functionality; use session snapshots and graceful fallbacks.
- [ ] Do not introduce infrastructure that violates the current Express, blueprint, API-first, SQLite-first architecture.
- [ ] Do not mark production readiness without unit, integration, e2e, security/privacy, and deployment validation evidence.

## Requirements Validation Summary

The implementation must deliver:

1. First-class unified student profile architecture and APIs.
2. Signal ledger for LMS, Career, Events, and Competition actions.
3. Privacy and visibility controls enforced on backend responses.
4. Shared recommendation APIs with explainable scoring and feedback.
5. LMS exam prep, discovery, quality, progress, and contribution loops.
6. Career profile, resume, opportunity fit, readiness, and skill-gap loops.
7. Events feed, team formation, competition, achievement, and analytics loops.
8. Regression tests proving the prior mistakes were not repeated.
9. Deployment validation notes proving production readiness gates were exercised.

## Current Implementation Strategy

The first corrective slice is the shared platform spine:

- Add `UnifiedProfileStore` as a SQLite-backed shared store.
- Add `/api/profile/*` routes for unified profile, signals, achievements, skills, privacy, and recomputation.
- Add `/api/recommendations/*` routes for unified home and domain recommendations.
- Add regression tests for aggregation, route contracts, privacy defaults, achievement sync, and explainable recommendations.

This reduces the risk that later LMS, Career, and Events enhancements become disconnected again.
