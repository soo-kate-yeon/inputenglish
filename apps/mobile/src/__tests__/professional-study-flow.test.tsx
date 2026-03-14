import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockRouterPush = jest.fn();

const mockSessionDetail = {
  id: "session-1",
  source_video_id: "test-video-123",
  title: "OpenAI 데모로 배우는 지표 설명하는 법",
  description: "지표 변화를 설명하는 흐름을 연습해요.",
  duration: 24,
  order_index: 0,
  source_type: "demo" as const,
  speaking_function: "explain-metric" as const,
  role_relevance: ["pm"] as const,
  premium_required: true,
  context: {
    strategic_intent: "수치 변화에 의미를 부여하는 문장 선택을 보여준다.",
    speaking_function: "explain-metric" as const,
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
    { id: "s1", text: "Hello world", startTime: 0, endTime: 2, highlights: [] },
    {
      id: "s2",
      text: "How are you?",
      startTime: 2,
      endTime: 4,
      highlights: [],
    },
  ],
  snippet_start_time: 0,
};

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

jest.mock("../../src/lib/api", () => ({
  fetchCuratedVideo: jest.fn().mockResolvedValue(mockVideo),
  fetchLearningSessionDetail: jest.fn().mockResolvedValue(mockSessionDetail),
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
    (_props: object, _ref: React.Ref<unknown>) =>
      React.createElement(View, { testID: "youtube-player" }),
  );
  MockPlayer.displayName = "YouTubePlayer";
  return { __esModule: true, default: MockPlayer };
});

describe("StudyScreen professional context flow", () => {
  const StudyScreen = require("../../app/study/[videoId]").default;

  beforeEach(() => {
    mockTrackEvent.mockClear();
    mockRouterPush.mockClear();
  });

  it("shows the locked premium brief and opens study content after continue", async () => {
    const { findByText, getByText, queryByText } = render(<StudyScreen />);

    expect(await findByText("PRE-LEARNING BRIEF")).toBeTruthy();

    expect(
      await findByText("이 세션의 프리러닝 브리프는 Premium에서 열립니다."),
    ).toBeTruthy();
    expect(await findByText("UNLOCK BRIEF")).toBeTruthy();
    expect(queryByText("LISTENING")).toBeNull();

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith("context_open", {
        sessionId: "session-1",
        premiumRequired: true,
        speakingFunction: "explain-metric",
      });
    });

    fireEvent.press(getByText("UNLOCK BRIEF"));
    expect(mockRouterPush).toHaveBeenCalledWith("/paywall");

    fireEvent.press(getByText("CONTINUE TO STUDY"));

    await waitFor(() => {
      expect(getByText("LISTENING")).toBeTruthy();
      expect(getByText("SHADOWING")).toBeTruthy();
    });

    expect(mockTrackEvent).toHaveBeenCalledWith("session_start", {
      sessionId: "session-1",
      sourceType: "demo",
      speakingFunction: "explain-metric",
    });
  });
});
