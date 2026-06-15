import { describe, expect, it, vi } from "vitest";
import {
  buildPremiumDailyPushMessage,
  sendPremiumDailyCurationPush,
} from "./push-notifications";

const session = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Premium daily session",
  description: "A focused curation for today.",
};

describe("premium daily push notifications", () => {
  it("builds an Expo push payload with the premium session deeplink", () => {
    expect(
      buildPremiumDailyPushMessage("ExponentPushToken[token-1]", session),
    ).toMatchObject({
      to: "ExponentPushToken[token-1]",
      sound: "default",
      title: "오늘의 큐레이션이 도착했어요",
      body: "Premium daily session - A focused curation for today.",
      data: {
        type: "premium-daily-curation",
        premiumSessionId: session.id,
        screen: `/premium/${session.id}`,
      },
    });
  });

  it("sends one Expo push per unique stored token", async () => {
    const select = vi.fn().mockResolvedValue({
      data: [
        { token: "ExponentPushToken[token-1]" },
        { token: "ExponentPushToken[token-1]" },
        { token: "ExponentPushToken[token-2]" },
        { token: "" },
      ],
      error: null,
    });
    const supabase = {
      from: vi.fn(() => ({ select })),
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ status: "ok", id: "ticket-1" }, { status: "ok" }],
      }),
    });

    const result = await sendPremiumDailyCurationPush(session, {
      supabase: supabase as never,
      fetch: fetchImpl as unknown as typeof fetch,
    });

    expect(supabase.from).toHaveBeenCalledWith("push_tokens");
    expect(select).toHaveBeenCalledWith("token");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/send",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify([
          buildPremiumDailyPushMessage("ExponentPushToken[token-1]", session),
          buildPremiumDailyPushMessage("ExponentPushToken[token-2]", session),
        ]),
      }),
    );
    expect(result).toEqual({
      sent: 2,
      tickets: [{ status: "ok", id: "ticket-1" }, { status: "ok" }],
    });
  });

  it("does not call Expo when there are no stored tokens", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };
    const fetchImpl = vi.fn();

    await expect(
      sendPremiumDailyCurationPush(session, {
        supabase: supabase as never,
        fetch: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ sent: 0, tickets: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
