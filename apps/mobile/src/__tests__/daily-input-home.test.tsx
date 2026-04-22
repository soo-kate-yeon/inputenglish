import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockPush = jest.fn();
const mockTrackEvent = jest.fn();
const mockFetchLearningSessionsPaginated = jest.fn();
const mockFetchSessionsByIds = jest.fn();
const mockFetchCuratedVideo = jest.fn();
const mockRecordSessionVisit = jest.fn();
const mockAddSavedSentence = jest.fn();
const mockRemoveSavedSentence = jest.fn();

let mockPlan: "FREE" | "PREMIUM" = "PREMIUM";
let mockSavedShortEntries: Array<{
  sessionId: string;
  videoId: string;
  savedAt: number;
}> = [];
let mockSavedSentences: Array<{
  id: string;
  sentenceId: string;
  videoId: string;
}> = [];

const mockAuthState = {
  user: { id: "user-1" },
  learningProfile: {
    user_id: "user-1",
    level_band: "conversation",
    goal_mode: "expression",
    focus_tags: ["회의/업데이트"],
    preferred_speakers: ["Aubrey Plaza"],
    preferred_situations: ["회의/업데이트"],
    preferred_video_categories: ["셀럽 인터뷰"],
    onboarding_completed_at: "2026-04-18T00:00:00.000Z",
  },
  isProfileLoading: false,
};

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    router: {
      push: (...args: unknown[]) => mockPush(...args),
    },
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => {
        const cleanup = callback();
        return cleanup;
      }, [callback]);
    },
  };
});

jest.mock("react-native/Libraries/Lists/FlatList", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockFlatList = React.forwardRef(
    (
      props: {
        data?: unknown[];
        renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
        keyExtractor?: (item: unknown, index: number) => string;
        onLayout?: (event: {
          nativeEvent: { layout: { height: number; width: number } };
        }) => void;
      },
      ref: React.ForwardedRef<{ scrollToOffset: jest.Mock }>,
    ) => {
      React.useImperativeHandle(ref, () => ({
        scrollToOffset: jest.fn(),
      }));

      React.useEffect(() => {
        props.onLayout?.({
          nativeEvent: { layout: { height: 720, width: 390 } },
        });
      }, [props]);

      return React.createElement(
        View,
        null,
        (props.data ?? []).map((item, index) =>
          React.createElement(
            React.Fragment,
            {
              key: props.keyExtractor
                ? props.keyExtractor(item, index)
                : String(index),
            },
            props.renderItem({ item, index }),
          ),
        ),
      );
    },
  );

  MockFlatList.displayName = "MockFlatList";
  return MockFlatList;
});

jest.mock("../../src/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => mockAuthState),
}));

jest.mock("../../src/hooks/useSubscription", () => ({
  useSubscription: jest.fn(() => ({
    plan: mockPlan,
    canUseAI: mockPlan !== "FREE",
    isLoading: false,
    refresh: jest.fn(),
  })),
}));

jest.mock("../../src/lib/api", () => ({
  fetchLearningSessionsPaginated: (...args: unknown[]) =>
    mockFetchLearningSessionsPaginated(...args),
  fetchSessionsByIds: (...args: unknown[]) => mockFetchSessionsByIds(...args),
  fetchCuratedVideo: (...args: unknown[]) => mockFetchCuratedVideo(...args),
}));

jest.mock("../../src/lib/recent-sessions", () => ({
  getRecentSessionIds: jest.fn(() => []),
  recordSessionVisit: (...args: unknown[]) => mockRecordSessionVisit(...args),
}));

jest.mock("../../src/lib/saved-shorts", () => ({
  getSavedShortSessionIds: jest.fn(() =>
    mockSavedShortEntries.map((entry) => entry.sessionId),
  ),
  toggleSavedShortSession: jest.fn((sessionId: string, videoId: string) => {
    const exists = mockSavedShortEntries.some(
      (entry) => entry.sessionId === sessionId,
    );

    if (exists) {
      mockSavedShortEntries = mockSavedShortEntries.filter(
        (entry) => entry.sessionId !== sessionId,
      );
      return { saved: false, entries: mockSavedShortEntries };
    }

    mockSavedShortEntries = [
      {
        sessionId,
        videoId,
        savedAt: Date.now(),
      },
      ...mockSavedShortEntries,
    ];

    return { saved: true, entries: mockSavedShortEntries };
  }),
}));

jest.mock("../../src/lib/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock("../../src/lib/stores", () => ({
  appStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      savedSentences: mockSavedSentences,
      addSavedSentence: (...args: unknown[]) => mockAddSavedSentence(...args),
      removeSavedSentence: (...args: unknown[]) =>
        mockRemoveSavedSentence(...args),
    }),
}));

jest.mock("../../src/components/player/YouTubePlayer", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockPlayer = React.forwardRef(
    (
      props: {
        videoId: string;
        startSeconds?: number;
        onReady?: () => void;
      },
      ref: React.ForwardedRef<{ seekTo: jest.Mock }>,
    ) => {
      React.useEffect(() => {
        props.onReady?.();
      }, [props]);

      React.useImperativeHandle(ref, () => ({
        seekTo: jest.fn(),
        getCurrentTime: jest.fn().mockResolvedValue(0),
        getDuration: jest.fn().mockResolvedValue(120),
      }));

      return React.createElement(View, {
        testID: "youtube-player",
        accessibilityLabel: `youtube-player:${props.videoId}:${props.startSeconds ?? 0}`,
      });
    },
  );
  MockPlayer.displayName = "MockYouTubePlayer";
  return { __esModule: true, default: MockPlayer };
});

describe("Shorts home", () => {
  const session = {
    id: "session-1",
    source_video_id: "video-1",
    title: "Quarterly Wrap-up Podcast",
    subtitle: "Business Daily",
    description: "Best moments from the episode",
    duration: 180,
    start_time: 12,
    end_time: 48,
    sentence_ids: ["sentence-1"],
    difficulty: "intermediate" as const,
    order_index: 1,
    source_type: "podcast" as const,
    genre: "business" as const,
    video_categories: ["셀럽 인터뷰"],
    speaking_situations: ["회의/업데이트"],
    premium_required: false,
    expected_takeaway: "이 장면만 이해해도 회의 업데이트 표현 감이 잡혀요.",
    speaker_names: ["Aubrey Plaza"],
    primary_speaker_name: "Aubrey Plaza",
  };
  const adjacentSession = {
    ...session,
    id: "session-2",
    source_video_id: "video-2",
    title: "Office Hours Podcast",
    sentence_ids: ["sentence-2"],
    order_index: 2,
  };

  const HomeScreen = require("../../app/(tabs)/index").default;

  beforeEach(() => {
    mockPush.mockReset();
    mockTrackEvent.mockReset();
    mockFetchLearningSessionsPaginated.mockReset();
    mockFetchSessionsByIds.mockReset();
    mockFetchCuratedVideo.mockReset();
    mockRecordSessionVisit.mockReset();
    mockAddSavedSentence.mockReset();
    mockRemoveSavedSentence.mockReset();
    mockSavedShortEntries = [];
    mockSavedSentences = [];
    mockPlan = "PREMIUM";

    mockFetchLearningSessionsPaginated.mockResolvedValue({
      sessions: [session],
      hasMore: false,
    });
    mockFetchSessionsByIds.mockResolvedValue([]);
    mockFetchCuratedVideo.mockResolvedValue({
      video_id: "video-1",
      snippet_start_time: 0,
      transcript: [
        {
          id: "sentence-1",
          text: "Let me walk you through the update.",
          translation: "업데이트를 차근차근 설명드릴게요.",
          startTime: 12,
          endTime: 16,
        },
      ],
    });
  });

  it("replaces daily input with shorts feed", async () => {
    const screen = render(<HomeScreen />);

    expect(screen.queryByText("오늘의 인풋")).toBeNull();
    expect(await screen.findByText("Quarterly Wrap-up Podcast")).toBeTruthy();
    expect(
      await screen.findByText("Let me walk you through the update."),
    ).toBeTruthy();
    expect(screen.getByText("쇼츠")).toBeTruthy();
  });

  it("opens the current session as a long-session fallback", async () => {
    const screen = render(<HomeScreen />);

    await screen.findByText("Quarterly Wrap-up Podcast");
    fireEvent.press(
      screen.getByLabelText("Quarterly Wrap-up Podcast 롱세션 열기"),
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/study/video-1?sessionId=session-1",
      );
    });
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "shorts_long_session_fallback_used",
      expect.objectContaining({
        sessionId: "session-1",
      }),
    );
  });

  it("routes free users to the paywall for premium sessions", async () => {
    mockPlan = "FREE";
    mockFetchLearningSessionsPaginated.mockResolvedValue({
      sessions: [{ ...session, premium_required: true }],
      hasMore: false,
    });

    const screen = render(<HomeScreen />);

    await screen.findByText("Quarterly Wrap-up Podcast");
    fireEvent.press(
      screen.getByLabelText("Quarterly Wrap-up Podcast 롱세션 열기"),
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/paywall");
    });
  });

  it("can save a short and view it in the saved filter", async () => {
    const screen = render(<HomeScreen />);

    await screen.findByText("Quarterly Wrap-up Podcast");
    fireEvent.press(
      screen.getByLabelText("Quarterly Wrap-up Podcast 쇼츠 저장"),
    );
    fireEvent.press(screen.getByText("저장됨"));

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "short_session_saved",
        expect.objectContaining({
          sessionId: "session-1",
        }),
      );
    });

    expect(screen.getByText("Quarterly Wrap-up Podcast")).toBeTruthy();
  });

  it("prefetches the next short so swiping does not stall on a loading placeholder", async () => {
    mockFetchLearningSessionsPaginated.mockResolvedValue({
      sessions: [session, adjacentSession],
      hasMore: false,
    });
    mockFetchCuratedVideo.mockImplementation(async (videoId: string) => ({
      video_id: videoId,
      snippet_start_time: 0,
      transcript: [
        {
          id: videoId === "video-1" ? "sentence-1" : "sentence-2",
          text: "Let me walk you through the update.",
          translation: "업데이트를 차근차근 설명드릴게요.",
          startTime: 12,
          endTime: 16,
        },
      ],
    }));

    render(<HomeScreen />);

    await waitFor(() => {
      expect(mockFetchCuratedVideo).toHaveBeenCalledWith("video-1");
      expect(mockFetchCuratedVideo).toHaveBeenCalledWith("video-2");
    });
  });
});
