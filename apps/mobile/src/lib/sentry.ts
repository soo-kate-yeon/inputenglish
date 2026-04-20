import * as SentryRN from "@sentry/react-native";
import Constants from "expo-constants";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const release = Constants.expoConfig?.version ?? "unknown";
const dist =
  Constants.expoConfig?.ios?.buildNumber ??
  String(Constants.expoConfig?.android?.versionCode ?? "unknown");

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  if (!dsn) {
    console.warn(
      "[Sentry] EXPO_PUBLIC_SENTRY_DSN is not set. Sentry is disabled.",
    );
    return;
  }

  SentryRN.init({
    dsn,
    release,
    dist,
    environment: __DEV__ ? "development" : "production",
    tracesSampleRate: __DEV__ ? 0 : 0.2,
    enableAutoSessionTracking: true,
    attachStacktrace: true,
    enableNativeCrashHandling: true,
  });

  initialized = true;
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!initialized) return;
  SentryRN.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "info",
  context?: Record<string, unknown>,
): void {
  if (!initialized) return;
  SentryRN.captureMessage(message, {
    level,
    extra: context,
  });
}

export function addBreadcrumb(breadcrumb: {
  category: string;
  message?: string;
  level?: "fatal" | "error" | "warning" | "info" | "debug";
  data?: Record<string, unknown>;
}): void {
  if (!initialized) return;
  SentryRN.addBreadcrumb(breadcrumb);
}

export function setUser(
  user: { id?: string; email?: string | null } | null,
): void {
  if (!initialized) return;
  if (!user) {
    SentryRN.setUser(null);
    return;
  }
  SentryRN.setUser({
    id: user.id,
    email: user.email ?? undefined,
  });
}

export const wrap = SentryRN.wrap;
