import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockPush = jest.fn();
const mockTrackEvent = jest.fn();
const mockGetDailyInputQueue = jest.fn();
const mockFetchCuratedVideo = jest.fn();
const mockUploadPronunciationRecording = jest.fn();
const mockRequestPronunciationAnalysis = jest.fn();
const mockWaitForPronunciationAnalysisCompletion = jest.fn();
const mockReadPronunciationAnalysisCache = jest.fn();
const mockWritePronunciationAnalysisCache = jest.fn();
const mockUploadTransformationRecording = jest.fn();
const mockSaveTransformationAttempt = jest.fn();
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn();
const mockPlayRecording = jest.fn();
const mockPauseRecording = jest.fn();
const mockResetRecording = jest.fn();
let mockPlan: "FREE" | "PREMIUM" = "PREMIUM";
const mockAuthState = {
  user: { id: "user-1" },
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
  audioUri: null,
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

jest.mock("../../src/lib/transformation-api", () => ({
  uploadTransformationRecording: (...args: unknown[]) =>
    mockUploadTransformationRecording(...args),
  saveTransformationAttempt: (...args: unknown[]) =>
    mockSaveTransformationAttempt(...args),
}));

jest.mock("../../src/lib/ai-api", () => ({
  uploadRecording: (...args: unknown[]) =>
    mockUploadPronunciationRecording(...args),
  requestPronunciationAnalysis: (...args: unknown[]) =>
    mockRequestPronunciationAnalysis(...args),
  waitForPronunciationAnalysisCompletion: (...args: unknown[]) =>
    mockWaitForPronunciationAnalysisCompletion(...args),
}));

jest.mock("../../src/lib/pronunciation-analysis-cache", () => ({
  readPronunciationAnalysisCache: (...args: unknown[]) =>
    mockReadPronunciationAnalysisCache(...args),
  writePronunciationAnalysisCache: (...args: unknown[]) =>
    mockWritePronunciationAnalysisCache(...args),
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

jest.mock("../../src/hooks/useSubscription", () => ({
  useSubscription: jest.fn(() => ({
    plan: mockPlan,
    canUseAI: mockPlan !== "FREE",
    isLoading: false,
    refresh: jest.fn(),
  })),
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
    mockUploadPronunciationRecording.mockReset();
    mockRequestPronunciationAnalysis.mockReset();
    mockWaitForPronunciationAnalysisCompletion.mockReset();
    mockReadPronunciationAnalysisCache.mockReset();
    mockWritePronunciationAnalysisCache.mockReset();
    mockUploadTransformationRecording.mockReset();
    mockSaveTransformationAttempt.mockReset();
    mockStartRecording.mockReset();
    mockStopRecording.mockReset();
    mockPlayRecording.mockReset();
    mockPauseRecording.mockReset();
    mockResetRecording.mockReset();
    mockAuthState.learningProfile = {
      user_id: "user-1",
      level_band: "conversation",
      goal_mode: "expression",
      focus_tags: ["회의/업데이트"],
      preferred_speakers: [],
      preferred_situations: ["회의/업데이트"],
      onboarding_completed_at: "2026-04-18T00:00:00.000Z",
    };
    mockRecorderState.recordingState = "idle";
    mockRecorderState.audioUri = null;
    mockRecorderState.duration = 0;
    mockPlan = "PREMIUM";
    mockFetchCuratedVideo.mockResolvedValue({
      video_id: "video-1",
      snippet_start_time: 100,
      transcript: [],
    });
    mockUploadPronunciationRecording.mockResolvedValue(
      "https://cdn.example.com/pronunciation.m4a",
    );
    mockReadPronunciationAnalysisCache.mockReturnValue(null);
    mockRequestPronunciationAnalysis.mockResolvedValue({
      analysis_id: "analysis-1",
      status: "processing",
      provider: "azure",
      provider_locale: "en-US",
      result: null,
      error: null,
    });
    mockWaitForPronunciationAnalysisCompletion.mockResolvedValue({
      analysis_id: "analysis-1",
      status: "complete",
      provider: "azure",
      provider_locale: "en-US",
      result: {
        status: "complete",
        provider: "azure",
        reference_text: "Let me walk you through the update.",
        overall_score: 84,
        summary: "핵심은 잘 들리지만 문장 끝 처리가 조금 빨라요.",
        clarity_note: "walk와 through를 더 분리해서 말하면 좋아요.",
        stress_note: "update에 강세를 조금 더 실어보세요.",
        next_focus:
          "문장 끝을 급하게 내리지 말고 마지막 단어를 조금 더 길게 유지해보세요.",
      },
      error: null,
    });
    mockUploadTransformationRecording.mockResolvedValue(
      "https://cdn.example.com/recording.m4a",
    );
    mockSaveTransformationAttempt.mockResolvedValue({ id: "attempt-1" });
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
        transformationSet: {
          id: "set-1",
          session_id: "session-1",
          target_pattern: "업데이트 공유하기",
          pattern_type: "responding",
          source_sentence_ids: ["sentence-1"],
          generated_by: "manual",
          created_at: "2026-04-18T00:00:00.000Z",
          updated_at: "2026-04-18T00:00:00.000Z",
          exercises: [
            {
              id: "exercise-1",
              set_id: "set-1",
              page_order: 1,
              exercise_type: "kr-to-en",
              instruction_text: "핵심 업데이트를 바로 영어로 말해보세요.",
              source_korean: "업데이트를 차근차근 설명드릴게요.",
              reference_answer: "Let me walk you through the update.",
              created_at: "2026-04-18T00:00:00.000Z",
              updated_at: "2026-04-18T00:00:00.000Z",
            },
            {
              id: "exercise-2",
              set_id: "set-1",
              page_order: 2,
              exercise_type: "qa-response",
              instruction_text: "핵심 질문에 짧게 답해보세요.",
              question_text: "What changed this week?",
              reference_answer:
                "The main update is that we streamlined the rollout.",
              created_at: "2026-04-18T00:00:00.000Z",
              updated_at: "2026-04-18T00:00:00.000Z",
            },
          ],
        },
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
    const {
      findAllByText,
      findByLabelText,
      getAllByText,
      getByLabelText,
      getByTestId,
    } = render(<HomeScreen />);

    expect((await findAllByText("오늘의 인풋")).length).toBeGreaterThan(0);
    expect(
      (await findAllByText("Let me walk you through the update.")).length,
    ).toBeGreaterThanOrEqual(1);

    fireEvent.press(getByLabelText("번역 보기 토글"));
    expect(getAllByText("업데이트를 차근차근 설명드릴게요.").length).toBe(2);

    fireEvent.press(await findByLabelText("학습 문장 재생"));
    expect(getByTestId("youtube-player")).toBeTruthy();

    fireEvent.press(getByLabelText("즉시 녹음 시작"));

    await waitFor(() => {
      expect(mockStartRecording).toHaveBeenCalled();
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect((await findAllByText("업데이트 공유하기")).length).toBeGreaterThan(
      0,
    );
    expect(
      (
        await findAllByText(
          "이 패턴은 비슷한 상황에서 바로 꺼내 쓸수록 내 표현으로 굳어져요.",
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await findAllByText(
          "위에서 배운 표현을 사용해 아래 한국어 문장을 영어로 바꿔보세요.",
        )
      ).length,
    ).toBeGreaterThan(0);

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

  it("runs inline pronunciation analysis and shows coaching on the card", async () => {
    mockAuthState.learningProfile = {
      ...mockAuthState.learningProfile,
      goal_mode: "pronunciation",
      preferred_speakers: ["Michelle Obama"],
      focus_tags: [],
      preferred_situations: [],
    };
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
        mode: "pronunciation",
        isReview: false,
        cardOrder: 0,
        reason: "발음 교정용 문장",
      },
    ]);

    const { findByLabelText, findByText, rerender } = render(<HomeScreen />);

    fireEvent.press(await findByLabelText("즉시 녹음 시작"));

    await waitFor(() => {
      expect(mockStartRecording).toHaveBeenCalled();
    });

    mockRecorderState.recordingState = "recording";
    rerender(<HomeScreen />);

    fireEvent.press(await findByLabelText("녹음 중지"));

    await waitFor(() => {
      expect(mockStopRecording).toHaveBeenCalled();
    });

    mockRecorderState.recordingState = "playback";
    mockRecorderState.audioUri = "file:///pronunciation-recording.m4a";
    mockRecorderState.duration = 4;
    rerender(<HomeScreen />);

    fireEvent.press(await findByLabelText("발음 분석하기"));

    await waitFor(() => {
      expect(mockUploadPronunciationRecording).toHaveBeenCalledWith(
        "file:///pronunciation-recording.m4a",
        "user-1",
        "video-1",
        "sentence-1",
        4,
      );
    });

    expect(mockRequestPronunciationAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "daily-input",
        sentenceId: "sentence-1",
        videoId: "video-1",
      }),
    );
    expect(
      await findByText("핵심은 잘 들리지만 문장 끝 처리가 조금 빨라요."),
    ).toBeTruthy();
    expect(
      await findByText("walk와 through를 더 분리해서 말하면 좋아요."),
    ).toBeTruthy();

    expect(mockTrackEvent).toHaveBeenCalledWith(
      "pronunciation_analysis_complete",
      expect.objectContaining({
        sessionId: "session-1",
        sentenceId: "sentence-1",
        analysisId: "analysis-1",
      }),
    );
  });

  it("reveals sample answer after a successful saved attempt exists", async () => {
    const { findByLabelText, findByText, getAllByText, rerender } = render(
      <HomeScreen />,
    );

    fireEvent.press(await findByLabelText("표현 연습 녹음 시작"));

    await waitFor(() => {
      expect(mockStartRecording).toHaveBeenCalled();
    });

    mockRecorderState.recordingState = "recording";
    rerender(<HomeScreen />);

    fireEvent.press(await findByLabelText("표현 연습 녹음 완료"));

    await waitFor(() => {
      expect(mockStopRecording).toHaveBeenCalled();
    });

    mockRecorderState.recordingState = "playback";
    mockRecorderState.audioUri = "file:///recording.m4a";
    rerender(<HomeScreen />);

    await waitFor(() => {
      expect(mockUploadTransformationRecording).toHaveBeenCalledWith(
        "file:///recording.m4a",
        "user-1",
        "exercise-1",
      );
    });
    expect(mockSaveTransformationAttempt).toHaveBeenCalled();
    expect(await findByLabelText("모범답안 보기")).toBeTruthy();
    expect(await findByText("눌러서 모범답안 보기")).toBeTruthy();

    fireEvent.press(await findByLabelText("모범답안 보기"));

    expect(getAllByText("Let me walk you through the update.").length).toBe(2);

    expect(mockTrackEvent).toHaveBeenCalledWith(
      "expression_sample_answer_open",
      expect.objectContaining({
        sessionId: "session-1",
        sentenceId: "sentence-1",
        exerciseId: "exercise-1",
      }),
    );
  });

  it("sends FREE users to paywall right before opening sample answer", async () => {
    mockPlan = "FREE";
    const { findByLabelText, rerender } = render(<HomeScreen />);

    fireEvent.press(await findByLabelText("표현 연습 녹음 시작"));

    mockRecorderState.recordingState = "recording";
    rerender(<HomeScreen />);

    fireEvent.press(await findByLabelText("표현 연습 녹음 완료"));

    mockRecorderState.recordingState = "playback";
    mockRecorderState.audioUri = "file:///recording.m4a";
    rerender(<HomeScreen />);

    await waitFor(() => {
      expect(mockSaveTransformationAttempt).toHaveBeenCalled();
    });

    fireEvent.press(await findByLabelText("모범답안 보기"));

    expect(mockPush).toHaveBeenCalledWith("/paywall");
    expect(mockTrackEvent).not.toHaveBeenCalledWith(
      "expression_sample_answer_open",
      expect.anything(),
    );
  });
});
