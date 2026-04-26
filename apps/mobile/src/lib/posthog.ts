import PostHog from "posthog-react-native";

export const posthog = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "", {
  host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  disabled: !process.env.EXPO_PUBLIC_POSTHOG_KEY,
});

export function identifyUser(
  userId: string,
  properties?: Record<string, string | undefined>,
) {
  posthog.identify(userId, properties as Record<string, string>);
}

export function resetAnalyticsUser() {
  posthog.reset();
}
