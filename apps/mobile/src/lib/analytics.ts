export type AnalyticsEventName =
  | "context_open"
  | "session_start"
  | "onboarding_start"
  | "onboarding_level_selected"
  | "onboarding_goal_selected"
  | "onboarding_complete"
  | "daily_input_impression"
  | "daily_input_seek_play"
  | "daily_input_record_start"
  | "daily_input_repeat_toggle"
  | "daily_input_swipe"
  | "expression_practice_start"
  | "expression_sample_answer_open"
  | "expression_practice_complete"
  | "pronunciation_analysis_start"
  | "pronunciation_analysis_complete"
  | "pronunciation_retry";

export function trackEvent(
  event: AnalyticsEventName,
  properties: Record<string, unknown> = {},
) {
  console.log("[Analytics]", event, properties);
}
