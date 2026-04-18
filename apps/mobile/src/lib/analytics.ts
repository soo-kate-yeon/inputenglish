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
  | "daily_input_swipe";

export function trackEvent(
  event: AnalyticsEventName,
  properties: Record<string, unknown> = {},
) {
  console.log("[Analytics]", event, properties);
}
