import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockPush = jest.fn();
const mockTrackEvent = jest.fn();
const mockGetDailyInputQueue = jest.fn();
const mockFetchCuratedVideo = jest.fn();
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn();
const mockPlayRecording = jest.fn();
const mockPauseRecording = jest.fn();
const mockResetRecording = jest.fn();
const mockAuthState = {
  learningProfile: {
    user_id: "user-1",
    level_band: "conversation",
    goal_mode: "expression",
    focus_tags: ["회의/업데이트"],
    preferred_speakers: [],
    preferred_situations: ["회의/업데이트"],
    onboarding_completed_at: "2026-04-18T00:00:00.000Z",
  },
  isProfileLoading: false,
};
const mockRecorderState = {
  recordingState: "idle",
  duration: 0,
  isPlaying: false,
  startRecording: (...args: unknown[]) => mockStartRecording(...args),
  stopRecording: (...args: unknown[]) => mockStopRecording(...args),
  playRecording: (...args: unknown[]) => mockPlayRecording(...args),
  pauseRecording: (...args: unknown[]) => mockPauseRecording(...args),
  resetRecording: (...args: unknown[]) => mockResetRecording(...args),
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

jest.mock("../../src/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => mockAuthState),
}));

jest.mock("../../src/lib/daily-input", () => ({
  getDailyInputQueue: (...args: unknown[]) => mockGetDailyInputQueue(...args),
}));

jest.mock("../../src/lib/api", () => ({
  fetchCuratedVideo: (...args: unknown[]) => mockFetchCuratedVideo(...args),
}));

jest.mock("../../src/lib/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock("../../src/hooks/useAudioRecorder", () => ({
  __esModule: true,
  default: jest.fn(() => mockRecorderState),
}));

jest.mock("../../src/components/player/YouTubePlayer", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockPlayer = React.forwardRef(
    (props: { startSeconds?: number }, _ref: unknown) =>
      React.createElement(View, {
        testID: "youtube-player",
        accessibilityLabel: `youtube-player:${props.startSeconds ?? 0}`,
      }),
  );
  MockPlayer.displayName = "YouTubePlayer";
  return { __esModule: true, default: MockPlayer };
});

describe("Daily input home", () => {
  const HomeScreen = require("../../app/(tabs)/index").default;

  beforeEach(() => {
    mockPush.mockClear();
    mockTrackEvent.mockClear();
    mockGetDailyInputQueue.mockReset();
    mockFetchCuratedVideo.mockReset();
    mockStartRecording.mockReset();
    mockStopRecording.mockReset();
    mockPlayRecording.mockReset();
    mockPauseRecording.mockReset();
    mockResetRecording.mockReset();
    mockFetchCuratedVideo.mockResolvedValue({
      video_id: "video-1",
      snippet_start_time: 100,
      transcript: [],
    });
    mockStartRecording.mockResolvedValue(true);
    mockStopRecording.mockResolvedValue("file:///recording.m4a");
    mockResetRecording.mockResolvedValue(undefined);
    mockGetDailyInputQueue.mockResolvedValue([
      {
        sessionId: "session-1",
        videoId: "video-1",
        title: "Quarterly Wrap-up Podcast",
        channelName: "Business Daily",
        sentenceId: "sentence-1",
        sentenceText: "Let me walk you through the update.",
        translation: "업데이트를 차근차근 설명드릴게요.",
        startTime: 2,
        endTime: 6,
        mode: "expression",
        isReview: true,
        cardOrder: 0,
        reason: "최근 학습한 흐름을 다시 꺼내보는 복습 카드",
      },
      {
        sessionId: "session-2",
        videoId: "video-2",
        title: "Demo Day",
        channelName: "OpenAI",
        sentenceId: "sentence-2",
        sentenceText: "Here is the one metric that matters most.",
        translation: "여기서 가장 중요한 지표는 하나입니다.",
        startTime: 10,
        endTime: 15,
        mode: "expression",
        isReview: false,
        cardOrder: 1,
        reason: "Demo Day에서 바로 써먹을 표현을 뽑아 연습하기 좋은 카드",
      },
    ]);
  });

  it("plays inside the card and starts inline recording", async () => {
    const { findByText, findByLabelText, getByLabelText, getByTestId } = render(
      <HomeScreen />,
    );

    expect(await findByText("오늘의 인풋")).toBeTruthy();
    expect(
      await findByText("Let me walk you through the update."),
    ).toBeTruthy();

    fireEvent.press(getByLabelText("번역 보기 토글"));
    expect(await findByText("업데이트를 차근차근 설명드릴게요.")).toBeTruthy();

    fireEvent.press(await findByLabelText("학습 문장 재생"));
    expect(getByTestId("youtube-player")).toBeTruthy();

    fireEvent.press(getByLabelText("즉시 녹음 시작"));

    await waitFor(() => {
      expect(mockStartRecording).toHaveBeenCalled();
    });

    expect(mockPush).not.toHaveBeenCalled();

    expect(mockTrackEvent).toHaveBeenCalledWith(
      "daily_input_seek_play",
      expect.objectContaining({
        sessionId: "session-1",
        sentenceId: "sentence-1",
      }),
    );
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "daily_input_record_start",
      expect.objectContaining({
        sessionId: "session-1",
        sentenceId: "sentence-1",
      }),
    );
  });

  it("moves to the full expression flow only from the secondary CTA", async () => {
    const { findByLabelText } = render(<HomeScreen />);

    fireEvent.press(
      await findByLabelText("Quarterly Wrap-up Podcast 원본 영상 열기"),
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/study/video-1?sessionId=session-1&sentenceId=sentence-1&initialTab=transformation",
      );
    });
  });
});
