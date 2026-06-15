const mockScheduleNotificationAsync = jest.fn();
const mockRouterPush = jest.fn();

jest.mock("expo-notifications", () => ({
  AndroidImportance: { MAX: "max" },
  SchedulableTriggerInputTypes: { DAILY: "daily" },
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  scheduleNotificationAsync: (...args: unknown[]) =>
    mockScheduleNotificationAsync(...args),
}));

jest.mock("expo-device", () => ({
  isDevice: true,
}));

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

import {
  buildPremiumDailyNotificationContent,
  handleNotificationResponse,
  PREMIUM_DAILY_NOTIFICATION_TRIGGER,
  schedulePremiumDailyCurationNotification,
} from "@/lib/push-notifications";
import { jonnyKimPremiumSessionFixture } from "@/fixtures/premium-session";

describe("premium daily push notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScheduleNotificationAsync.mockResolvedValue("notification-1");
  });

  it("builds a premium deep link payload for today's session", () => {
    expect(
      buildPremiumDailyNotificationContent(jonnyKimPremiumSessionFixture),
    ).toEqual(
      expect.objectContaining({
        title: "오늘의 큐레이션이 도착했어요",
        data: expect.objectContaining({
          type: "premium-daily-curation",
          premiumSessionId: jonnyKimPremiumSessionFixture.id,
          screen: `/premium/${jonnyKimPremiumSessionFixture.id}`,
        }),
      }),
    );
  });

  it("schedules the daily curation notification with a recurring daily trigger", async () => {
    await expect(
      schedulePremiumDailyCurationNotification(jonnyKimPremiumSessionFixture),
    ).resolves.toBe("notification-1");

    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: expect.objectContaining({
        data: expect.objectContaining({
          screen: `/premium/${jonnyKimPremiumSessionFixture.id}`,
        }),
      }),
      trigger: PREMIUM_DAILY_NOTIFICATION_TRIGGER,
    });
  });

  it("allows a caller to override the local trigger when needed", async () => {
    await expect(
      schedulePremiumDailyCurationNotification(
        jonnyKimPremiumSessionFixture,
        null,
      ),
    ).resolves.toBe("notification-1");

    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: null,
      }),
    );
  });

  it("routes notification taps to the premium session", () => {
    handleNotificationResponse({
      notification: {
        request: {
          content: {
            data: {
              screen: `/premium/${jonnyKimPremiumSessionFixture.id}`,
            },
          },
        },
      },
    } as never);

    expect(mockRouterPush).toHaveBeenCalledWith(
      `/premium/${jonnyKimPremiumSessionFixture.id}`,
    );
  });
});
