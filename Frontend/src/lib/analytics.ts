/**
 * analytics.ts — No-op analytics tracker with typed event names.
 *
 * Placeholder hooks that emit named events. The implementation is a no-op until
 * a real analytics backend is connected. Adding calls now means zero refactoring later.
 *
 * To wire up a real provider, replace the console.debug line below with:
 *   analytics.track(event, properties)
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
  | 'create_event_abandoned';     // route leave before Step 4

export function track(event: TrackEvent, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  // No-op until analytics provider is configured.
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, properties);
  }
}
