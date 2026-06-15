import type { PremiumSession } from "@inputenglish/shared";
import { premiumSessionFixture } from "@/fixtures/premium-session";
import { supabase } from "@/lib/supabase";

// babel-preset-expo inlines EXPO_PUBLIC_* only with dot notation.
const WEB_API_URL = process.env.EXPO_PUBLIC_WEB_API_URL ?? "";
const PREMIUM_FIXTURE_MODE = process.env.EXPO_PUBLIC_PREMIUM_FIXTURE_MODE ?? "";

export interface PremiumEntitlementPayload {
  hasAccess: boolean;
  plan: "FREE" | "PREMIUM";
  reason: "premium" | "trial" | "trial-expired";
  trialEndsAt: string | null;
}

export interface PremiumSessionResponse {
  entitlement: PremiumEntitlementPayload | null;
  session: PremiumSession | null;
}

class PremiumApiNonJsonError extends Error {
  constructor(
    public readonly status: number,
    public readonly contentType: string | null,
  ) {
    super(
      `프리미엄 API가 JSON 대신 ${contentType || "unknown"} 응답을 돌려줬어요.`,
    );
    this.name = "PremiumApiNonJsonError";
  }
}

class PremiumApiConfigurationError extends Error {
  constructor() {
    super("EXPO_PUBLIC_WEB_API_URL is not configured");
    this.name = "PremiumApiConfigurationError";
  }
}

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    ...(session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}),
    "Content-Type": "application/json",
  };
}

function getWebApiUrl(): string | null {
  const trimmed = (
    process.env["INPUTENGLISH_WEB_API_URL"] ??
    WEB_API_URL ??
    ""
  ).trim();
  return trimmed.length > 0 ? trimmed.replace(/\/$/, "") : null;
}

function isDevelopmentRuntime(): boolean {
  return typeof __DEV__ === "boolean"
    ? __DEV__
    : process.env.NODE_ENV !== "production";
}

function shouldForceFixtureMode(webApiUrl: string | null): boolean {
  if (!isDevelopmentRuntime()) return false;

  const explicit = (
    process.env["INPUTENGLISH_PREMIUM_FIXTURE_MODE"] ??
    PREMIUM_FIXTURE_MODE ??
    ""
  )
    .trim()
    .toLowerCase();
  if (["1", "true", "yes"].includes(explicit)) return true;
  if (["0", "false", "no"].includes(explicit)) return false;

  return !webApiUrl || webApiUrl.includes("inputenglish.vercel.app");
}

function buildFixtureResponse(sessionId?: string): PremiumSessionResponse {
  return {
    entitlement: {
      hasAccess: true,
      plan: "FREE",
      reason: "trial",
      trialEndsAt: null,
    },
    session:
      !sessionId || sessionId === premiumSessionFixture.id
        ? premiumSessionFixture
        : null,
  };
}

async function parsePremiumResponse(
  response: Response,
): Promise<PremiumSessionResponse & { error?: string }> {
  const contentType = response.headers.get("content-type");
  const rawBody = await response.text();
  let payload: PremiumSessionResponse & { error?: string };

  try {
    payload = JSON.parse(rawBody || "{}") as PremiumSessionResponse & {
      error?: string;
    };
  } catch {
    throw new PremiumApiNonJsonError(response.status, contentType);
  }

  return payload;
}

async function fetchPremiumJson(
  path: string,
  options: { fixtureSessionId?: string } = {},
): Promise<PremiumSessionResponse> {
  const webApiUrl = getWebApiUrl();
  if (shouldForceFixtureMode(webApiUrl)) {
    return buildFixtureResponse(options.fixtureSessionId);
  }
  if (!webApiUrl) {
    throw new PremiumApiConfigurationError();
  }

  try {
    const response = await fetch(`${webApiUrl}${path}`, {
      method: "GET",
      headers: await getAuthHeaders(),
    });
    const payload = await parsePremiumResponse(response);

    if (response.status === 402) {
      return payload;
    }

    if (!response.ok) {
      throw new Error(payload.error ?? "프리미엄 세션을 불러오지 못했어요.");
    }

    return payload;
  } catch (error) {
    if (isDevelopmentRuntime() && error instanceof PremiumApiNonJsonError) {
      console.warn(
        "[PremiumApi] Falling back to fixture after non-JSON API response",
        {
          path,
          status: error.status,
          contentType: error.contentType,
          webApiUrl,
        },
      );
      return buildFixtureResponse(options.fixtureSessionId);
    }
    throw error;
  }
}

export function fetchTodayPremiumSession(): Promise<PremiumSessionResponse> {
  return fetchPremiumJson("/api/premium/today");
}

export function fetchPremiumSessionById(
  sessionId: string,
): Promise<PremiumSessionResponse> {
  return fetchPremiumJson(`/api/premium/sessions/${sessionId}`, {
    fixtureSessionId: sessionId,
  });
}
