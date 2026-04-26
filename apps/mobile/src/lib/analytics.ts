import { addBreadcrumb } from "./sentry";
import { posthog } from "./posthog";

export type AnalyticsEventName =
  | "context_open"
  | "session_start"
  | "intro_impression"
  | "intro_page_view"
  | "intro_login_click"
  | "intro_signup_open_click"
  | "login_completed"
  | "signup_completed"
  | "onboarding_start"
  | "onboarding_step_viewed"
  | "onboarding_level_selected"
  | "onboarding_goal_selected"
  | "onboarding_complete"
  | "tab_changed"
  | "shorts_tab_entered"
  | "shorts_tab_exited"
  | "daily_input_impression"
  | "daily_input_seek_play"
  | "daily_input_record_start"
  | "daily_input_record_restart"
  | "daily_input_record_simulator_sample_loaded"
  | "daily_input_repeat_toggle"
  | "daily_input_swipe"
  | "shorts_session_impression"
  | "shorts_to_long_session_opened"
  | "shorts_long_session_fallback_used"
  | "longform_chapter_previewed"
  | "longform_chapter_practice_opened"
  | "short_session_saved"
  | "short_session_unsaved"
  | "expression_practice_start"
  | "expression_practice_simulator_sample_loaded"
  | "expression_sample_answer_open"
  | "expression_practice_complete"
  | "pronunciation_analysis_start"
  | "pronunciation_analysis_requested"
  | "pronunciation_analysis_complete"
  | "pronunciation_analysis_failed"
  | "pronunciation_retry";

export function trackEvent(
  event: AnalyticsEventName,
  properties: Record<string, unknown> = {},
) {
  // @MX:NOTE: Feed analytics into Sentry breadcrumbs so error reports include
  //           the user's recent event trail (e.g., record_start -> failed).
  addBreadcrumb({
    category: "analytics",
    message: event,
    level: event.includes("failed") ? "warning" : "info",
    data: properties,
  });

  posthog.capture(event, properties as any);
}
