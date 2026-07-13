# Companion Platform UAT Scripts

Date: 2026-06-18

Use these scripts in staging with real authenticated student/admin accounts before production promotion.

## UAT 1: Exam-Week Student

Persona: 3rd-year CSE student preparing for an end-semester exam.

Preconditions:

- Student has an active ERP session.
- LMS has at least one PYQ and one non-PYQ resource for the same subject.

Steps:

1. Open Learning Home.
2. Confirm Exam prep section appears.
3. Open the top exam-prep resource.
4. Confirm resource details show subject, unit, type, and quality/exam signals.
5. Bookmark or view the resource.
6. Return to Learning Home and confirm recommendations still load.

Pass criteria:

- Exam-prep resources are relevant to the student subject context.
- PYQs or exam-proven resources rank above generic resources.
- No private Career/Event data is publicly exposed.

## UAT 2: Placement-Focused Student

Persona: Student applying for internships.

Preconditions:

- Career catalog contains at least one opportunity with branch/year eligibility and skills.
- Student has a text or PDF resume available.

Steps:

1. Open Career Profile.
2. Upload the resume.
3. Confirm resume quality score, extracted skills, and suggestions appear.
4. Click Sync skills to profile.
5. Open an opportunity detail page.
6. Confirm Profile Fit shows score, matched skills, gaps, and recommendation.

Pass criteria:

- Resume remains private.
- Skill merge is explicit, not automatic.
- Opportunity fit is explainable and reflects eligibility and skills.

## UAT 3: Competition Participant and Team Leader

Persona: Student joining a team-scoped competition.

Preconditions:

- A published team-scoped competition exists.
- At least three students are registered.

Steps:

1. Open the competition team page.
2. Create a team.
3. Publish team needs with at least two skills.
4. Confirm matched candidates are ranked with reasons.
5. Invite a candidate.
6. Sign in as invited student and accept invitation.
7. Submit a round entry as team leader.
8. Organizer evaluates, shortlists, and publishes results.
9. Student opens Unified Insights/Profile and confirms competition achievement is present and private by default.

Pass criteria:

- Non-leaders cannot publish team needs for another team.
- Matches exclude students already on a team.
- Published competition outcomes sync to achievements.

## UAT 4: Contributor or Organizer

Persona: Student contributor or club organizer.

Preconditions:

- Student can add LMS resources or manage a competition/event.

Steps:

1. Add an LMS resource with subject, unit, tags, and description.
2. Confirm duplicate/moderation safeguards behave as expected.
3. For organizer: open competition analytics and team/submission lists.
4. Confirm moderation, judging, and publish actions require appropriate permissions.

Pass criteria:

- Contributions gain trust/quality signals without bypassing moderation.
- Organizer actions are permission-gated.
- Student-facing achievements and recommendations remain explainable.

## Evidence Capture

For each UAT run, capture:

- Tester account role and anonymized user ID.
- Environment URL and build/version.
- Pass/fail per step.
- Screenshots for failed steps.
- API error payloads for any failed calls.
- Privacy observations for resume, achievements, LMS activity, and event participation.
