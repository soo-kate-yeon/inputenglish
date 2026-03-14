export type AnalyticsEventName = "context_open" | "session_start";

export function trackEvent(
  event: AnalyticsEventName,
  properties: Record<string, unknown> = {},
) {
  console.log("[Analytics]", event, properties);
}
