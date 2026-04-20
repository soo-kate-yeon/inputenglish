import { addBreadcrumb } from "./sentry";

export type AnalyticsEventName =
  | "context_open"
  | "session_start"
  | "intro_impression"
  | "intro_page_view"
  | "intro_login_click"
  | "intro_signup_open_click"
  | "onboarding_start"
  | "onboarding_level_selected"
  | "onboarding_goal_selected"
  | "onboarding_complete"
  | "daily_input_impression"
  | "daily_input_seek_play"
  | "daily_input_record_start"
  | "daily_input_record_restart"
  | "daily_input_record_simulator_sample_loaded"
  | "daily_input_repeat_toggle"
  | "daily_input_swipe"
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
  console.log("[Analytics]", event, properties);
  // @MX:NOTE: Feed analytics into Sentry breadcrumbs so error reports include
  //           the user's recent event trail (e.g., record_start -> failed).
  addBreadcrumb({
    category: "analytics",
    message: event,
    level: event.includes("failed") ? "warning" : "info",
    data: properties,
  });
}
