import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

// Mock react-native-safe-area-context for useSafeAreaInsets
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock MMKV (required by recent-sessions used in HomeScreen)
jest.mock("react-native-mmkv", () => {
  const store: Record<string, string> = {};
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      getString: (key: string) => store[key] ?? undefined,
      set: (key: string, value: string) => {
        store[key] = value;
      },
      delete: (key: string) => {
        delete store[key];
      },
      contains: (key: string) => key in store,
      getAllKeys: () => Object.keys(store),
    })),
  };
});

const mockRouterPush = jest.fn();
let mockPlan: "FREE" | "PREMIUM" = "PREMIUM";

const mockSessions = [
  {
    id: "session-1",
    source_video_id: "video-1",
    title: "OpenAI 데모로 배우는 지표 설명",
    description: "성과 공유에서 숫자를 설명하는 법",
    duration: 180,
    difficulty: "intermediate" as const,
    thumbnail_url: "",
    order_index: 0,
    source_type: "demo" as const,
    genre: "tech" as const,
    role_relevance: ["pm", "engineer"] as const,
    premium_required: true,
    channel_name: "OpenAI",
  },
  {
    id: "session-2",
    source_video_id: "video-2",
    title: "Quarterly Wrap-up Podcast",
    description: "핵심 업데이트를 짧게 요약하는 법",
    duration: 240,
    difficulty: "advanced" as const,
    thumbnail_url: "",
    order_index: 1,
    source_type: "podcast" as const,
    genre: "business" as const,
    role_relevance: ["marketer"] as const,
    premium_required: false,
    channel_name: "Business Daily",
  },
];

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    router: { push: (...args: unknown[]) => mockRouterPush(...args) },
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => {
        const cleanup = callback();
        return cleanup;
      }, [callback]);
    },
  };
});

jest.mock("../../src/lib/api", () => ({
  fetchFeaturedSpeakers: jest.fn().mockResolvedValue([]),
  fetchLearningSessions: jest.fn().mockResolvedValue(mockSessions),
  fetchLearningSessionsPaginated: jest.fn().mockResolvedValue({
    sessions: mockSessions,
    hasMore: false,
  }),
  fetchLearningSessionsByIds: jest.fn().mockResolvedValue([]),
}));

jest.mock("../../src/hooks/useSubscription", () => ({
  useSubscription: jest.fn(() => ({
    plan: mockPlan,
    canUseAI: mockPlan !== "FREE",
    isLoading: false,
    refresh: jest.fn(),
  })),
}));

describe("ExploreScreen professional discovery flow", () => {
  const ExploreScreen = require("../../app/(tabs)/explore").default;

  beforeEach(() => {
    mockRouterPush.mockClear();
    mockPlan = "PREMIUM";
  });

  it("shows featured + category cards and navigates to study with session id", async () => {
    const { findAllByText, findByText, getByText } = render(<ExploreScreen />);

    expect(await findByText("OpenAI 데모로 배우는 지표 설명")).toBeTruthy();
    expect(
      (await findAllByText("Quarterly Wrap-up Podcast")).length,
    ).toBeGreaterThan(0);
    expect(await findByText("팟캐스트")).toBeTruthy();

    fireEvent.press(getByText("OpenAI 데모로 배우는 지표 설명"));
    fireEvent.press((await findAllByText("Quarterly Wrap-up Podcast"))[0]);

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenNthCalledWith(
        1,
        "/study/video-1?sessionId=session-1",
      );
      expect(mockRouterPush).toHaveBeenNthCalledWith(
        2,
        "/study/video-2?sessionId=session-2",
      );
    });
  });

  it("sends FREE users to paywall for premium sessions only", async () => {
    mockPlan = "FREE";

    const { findAllByText, findByText, getByText } = render(<ExploreScreen />);

    fireEvent.press(await findByText("OpenAI 데모로 배우는 지표 설명"));
    fireEvent.press((await findAllByText("Quarterly Wrap-up Podcast"))[0]);

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenNthCalledWith(1, "/paywall");
      expect(mockRouterPush).toHaveBeenNthCalledWith(
        2,
        "/study/video-2?sessionId=session-2",
      );
    });
  });
});
