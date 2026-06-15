import { createAdminClient } from "@/utils/supabase/server";

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface PremiumDailyPushSession {
  id: string;
  title: string;
  description?: string | null;
}

export interface ExpoPushMessage {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: {
    type: "premium-daily-curation";
    premiumSessionId: string;
    screen: string;
  };
}

export interface PremiumDailyPushResult {
  sent: number;
  tickets: unknown[];
}

export function buildPremiumDailyPushMessage(
  token: string,
  session: PremiumDailyPushSession,
): ExpoPushMessage {
  return {
    to: token,
    sound: "default",
    title: "오늘의 큐레이션이 도착했어요",
    body: session.description
      ? `${session.title} - ${session.description}`
      : session.title,
    data: {
      type: "premium-daily-curation",
      premiumSessionId: session.id,
      screen: `/premium/${session.id}`,
    },
  };
}

function normalizeTickets(payload: unknown): unknown[] {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: unknown[] }).data;
  }
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    (payload as { data?: unknown }).data
  ) {
    return [(payload as { data: unknown }).data];
  }
  return [];
}

export async function sendPremiumDailyCurationPush(
  session: PremiumDailyPushSession,
  deps: {
    supabase?: AdminClient;
    fetch?: typeof fetch;
  } = {},
): Promise<PremiumDailyPushResult> {
  const supabase = deps.supabase ?? createAdminClient();
  const fetchImpl = deps.fetch ?? fetch;
  const { data, error } = await supabase.from("push_tokens").select("token");

  if (error) throw error;

  const tokens = Array.from(
    new Set(
      (data ?? [])
        .map((row: { token?: unknown }) =>
          typeof row.token === "string" ? row.token.trim() : "",
        )
        .filter(Boolean),
    ),
  );

  if (tokens.length === 0) {
    return { sent: 0, tickets: [] };
  }

  const messages = tokens.map((token) =>
    buildPremiumDailyPushMessage(token, session),
  );
  const response = await fetchImpl(EXPO_PUSH_SEND_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo push send failed: ${response.status}`);
  }

  return {
    sent: messages.length,
    tickets: normalizeTickets(await response.json()),
  };
}
