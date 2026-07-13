/**
 * analytics.ts — Typed companion analytics sender.
 *
 * Tracks product events through the internal API without blocking user flows.
 * Failures are intentionally swallowed because analytics must never break the app.
 */

type TrackEvent =
  | 'submission_form_viewed'
  | 'submission_started'          // user selects file or types link
  | 'submission_completed'        // API success
  | 'submission_failed'           // API error
  | 'evaluation_opened'           // organizer opens EvaluationPage
  | 'evaluation_started'          // organizer opens EvaluationPage
  | 'evaluation_saved'
  | 'shortlist_applied'
  | 'results_published'
  | 'leaderboard_viewed'
  | 'create_event_started'
  | 'create_event_quick_mode'
  | 'create_event_full_mode'
  | 'create_event_completed'
  | 'create_event_abandoned'      // route leave before Step 4
  | 'certificate_downloaded'
  | 'team_created'
  | 'team_invite_sent'
  | 'team_recruitment_posted'
  | 'resume_analyzed'
  | 'resume_skills_synced'
  | 'opportunity_fit_viewed'
  | 'career_achievements_synced'
  | 'career_achievement_visibility_changed'
  | 'lms_exam_prep_recommendations_viewed'
  | 'lms_roadmap_recommendations_viewed'
  | 'events_recommendations_viewed'
  | 'events_recommendation_clicked'
  | 'public_career_profile_viewed'
  | 'public_career_profile_link_copied'
  | 'public_career_profile_exported';

export function track(event: TrackEvent, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const payload = {
    event,
    properties: {
      ...(properties || {}),
      route: window.location?.pathname || "unknown",
    },
    route: window.location?.pathname || "unknown",
    occurredAt: new Date().toISOString(),
  };
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      "/api/analytics/events",
      new Blob([body], { type: "application/json" })
    );
    if (sent) {
      return;
    }
  }

  void fetch("/api/analytics/events", {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => undefined);

  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, properties);
  }
}
