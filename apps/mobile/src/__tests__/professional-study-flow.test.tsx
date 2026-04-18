import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

// Mock MMKV (required by TransformationCarousel)
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

// Mock expo-speech (required by useTTS used in TransformationCarousel)
jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn().mockResolvedValue(false),
}));

// Mock supabase (required by TransformationCarousel)
jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: { id: "user-1" } } }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

// Mock transformation API (required by TransformationCarousel)
jest.mock("../../src/lib/transformation-api", () => ({
  fetchTransformationSet: jest.fn().mockResolvedValue(null),
  saveTransformationAttempt: jest.fn().mockResolvedValue({ id: "attempt-1" }),
}));

const mockRouterPush = jest.fn();

const mockSessionDetail = {
  id: "session-1",
  source_video_id: "test-video-123",
  title: "OpenAI 데모로 배우는 지표 설명하는 법",
  description: "지표 변화를 설명하는 흐름을 연습해요.",
  duration: 24,
  start_time: 30,
  end_time: 54,
  sentence_ids: ["s2", "s3"],
  order_index: 0,
  source_type: "demo" as const,
  genre: "tech" as const,
  role_relevance: ["pm"] as const,
  premium_required: true,
  context: {
    strategic_intent: "수치 변화에 의미를 부여하는 문장 선택을 보여준다.",
    reusable_scenarios: ["실적 공유", "프로젝트 리뷰"],
    key_vocabulary: ["momentum", "signal"],
    grammar_rhetoric_note: "관찰 기반 설명을 유지한다.",
    expected_takeaway: "핵심 지표를 차분하게 설명할 수 있다.",
  },
};

const mockVideo = {
  id: "v1",
  video_id: "test-video-123",
  title: "Test Study Video",
  transcript: [
    {
      id: "s1",
      text: "Session 밖 문장",
      startTime: 0,
      endTime: 8,
      highlights: [],
    },
    {
      id: "s2",
      text: "Session 첫 문장",
      startTime: 30,
      endTime: 40,
      highlights: [],
    },
    {
      id: "s3",
      text: "Session 둘째 문장",
      startTime: 40,
      endTime: 54,
      highlights: [],
    },
  ],
  snippet_start_time: 120,
};

const mockPlayerProps: { startSeconds?: number } = {};

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: (...args: unknown[]) => mockRouterPush(...args),
  },
  useLocalSearchParams: jest.fn(() => ({
    videoId: "test-video-123",
    sessionId: "session-1",
  })),
}));

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "test-uuid"),
}));

jest.mock("../../src/lib/api", () => ({
  fetchCuratedVideo: jest.fn().mockResolvedValue(mockVideo),
  fetchLearningSessionDetail: jest.fn().mockResolvedValue(mockSessionDetail),
  fetchPlaybookEntries: jest.fn().mockResolvedValue([]),
  deletePlaybookEntry: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/lib/stores", () => ({
  appStore: jest.fn((selector) =>
    selector({
      savedSentences: [],
      addSavedSentence: jest.fn(),
      removeSavedSentence: jest.fn(),
    }),
  ),
  studyStore: Object.assign(
    jest.fn(() => ({
      sessions: [],
    })),
    {
      getState: jest.fn(() => ({
        sessions: [],
        createSession: jest.fn(),
      })),
    },
  ),
}));

jest.mock("../../src/hooks/useAudioRecorder", () =>
  jest.fn(() => ({
    recordingState: "idle",
    audioUri: null,
    duration: 0,
    isPlaying: false,
    playbackProgress: 0,
    isRecorderBusy: false,
    lastError: null,
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    playRecording: jest.fn(),
    pauseRecording: jest.fn(),
    resetRecording: jest.fn(),
  })),
);

jest.mock("../../src/lib/ai-api", () => ({
  uploadRecording: jest.fn(),
}));

jest.mock("../../src/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({
    user: { id: "user-1" },
  })),
}));

jest.mock("../../src/hooks/useSubscription", () => ({
  useSubscription: jest.fn(() => ({
    plan: "FREE",
    canUseAI: false,
    isLoading: false,
    refresh: jest.fn(),
  })),
}));

const mockTrackEvent = jest.fn();

jest.mock("../../src/lib/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock("../../src/components/player/YouTubePlayer", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockPlayer = React.forwardRef(
    (props: { startSeconds?: number }, _ref: React.Ref<unknown>) => {
      mockPlayerProps.startSeconds = props.startSeconds;
      return React.createElement(View, { testID: "youtube-player" });
    },
  );
  MockPlayer.displayName = "YouTubePlayer";
  return { __esModule: true, default: MockPlayer };
});

describe("StudyScreen professional context flow", () => {
  const StudyScreen = require("../../app/study/[videoId]").default;

  beforeEach(() => {
    mockTrackEvent.mockClear();
    mockRouterPush.mockClear();
    mockPlayerProps.startSeconds = undefined;
  });

  it("shows context immediately and starts playback at the session offset", async () => {
    const { findByText, getByText, queryByText } = render(<StudyScreen />);

    expect(await findByText("학습 후 기대 효과")).toBeTruthy();
    expect(
      await findByText("핵심 지표를 차분하게 설명할 수 있다."),
    ).toBeTruthy();
    expect(
      queryByText("전체 브리프는 프리미엄에서 확인할 수 있어요"),
    ).toBeNull();
    expect(queryByText("프리미엄 시작")).toBeNull();
    expect(queryByText("리스닝")).toBeNull();

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith("context_open", {
        sessionId: "session-1",
        premiumRequired: true,
      });
    });

    fireEvent.press(getByText("학습 시작"));

    await waitFor(() => {
      expect(getByText("리스닝")).toBeTruthy();
      expect(getByText("쉐도잉")).toBeTruthy();
    });

    expect(getByText("스크립트가 숨겨져 있어요")).toBeTruthy();
    expect(queryByText("Session 첫 문장")).toBeNull();
    expect(queryByText("Session 둘째 문장")).toBeNull();
    expect(queryByText("Session 밖 문장")).toBeNull();
    expect(mockPlayerProps.startSeconds).toBe(150);

    expect(mockTrackEvent).toHaveBeenCalledWith("session_start", {
      sessionId: "session-1",
      sourceType: "demo",
    });
    expect(mockRouterPush).not.toHaveBeenCalledWith("/paywall");
  });
});
