import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import PremiumSessionScreen from "../PremiumSessionScreen";
import { jonnyKimPremiumSessionFixture } from "@/fixtures/premium-session";
import {
  clearPremiumSessionProgress,
  getPremiumSessionProgress,
} from "@/lib/premium-session-progress";

const mockRequestPronunciationAnalysis = jest.fn();
const mockWaitForPronunciationAnalysisCompletion = jest.fn();
const mockPersistPremiumCompletionAssets = jest.fn();
let mockRecorder = {
  recordingState: "idle" as const,
  audioUri: null as string | null,
  duration: 0,
  isPlaying: false,
  playbackProgress: 0,
  hasPermission: true,
  isRecorderBusy: false,
  lastError: null,
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  playRecording: jest.fn(),
  pauseRecording: jest.fn(),
  resetRecording: jest.fn(),
  requestPermission: jest.fn(),
  loadSimulatorSampleRecording: jest.fn(),
};

jest.mock("@/components/player/YouTubePlayer", () => {
  const React = require("react");
  const { View } = require("react-native");
  return React.forwardRef(
    (_props: unknown, ref: React.ForwardedRef<Record<string, unknown>>) => {
      React.useImperativeHandle(ref, () => ({
        seekTo: jest.fn(),
        getCurrentTime: jest.fn(() => Promise.resolve(0)),
        getDuration: jest.fn(() => Promise.resolve(60)),
      }));
      return React.createElement(View, { testID: "youtube-player" });
    },
  );
});

jest.mock("@/hooks/useAudioRecorder", () => ({
  __esModule: true,
  default: jest.fn(() => mockRecorder),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({ user: { id: "user-1" } })),
}));

jest.mock("@/lib/ai-api", () => ({
  requestPronunciationAnalysis: (...args: unknown[]) =>
    mockRequestPronunciationAnalysis(...args),
  uploadRecording: jest.fn(),
  waitForPronunciationAnalysisCompletion: (...args: unknown[]) =>
    mockWaitForPronunciationAnalysisCompletion(...args),
}));

jest.mock("@/lib/premium-completion", () => ({
  persistPremiumCompletionAssets: (...args: unknown[]) =>
    mockPersistPremiumCompletionAssets(...args),
}));

describe("PremiumSessionScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecorder = {
      recordingState: "idle",
      audioUri: null,
      duration: 0,
      isPlaying: false,
      playbackProgress: 0,
      hasPermission: true,
      isRecorderBusy: false,
      lastError: null,
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
      playRecording: jest.fn(),
      pauseRecording: jest.fn(),
      resetRecording: jest.fn(),
      requestPermission: jest.fn(),
      loadSimulatorSampleRecording: jest.fn(),
    };
    mockPersistPremiumCompletionAssets.mockResolvedValue(2);
    clearPremiumSessionProgress(jonnyKimPremiumSessionFixture.id);
  });

  it("starts on the article reader with the speaker background copy", () => {
    const { getByTestId, getByText, queryByText } = render(
      <PremiumSessionScreen session={jonnyKimPremiumSessionFixture} />,
    );

    expect(getByTestId("premium-article-reader")).toBeTruthy();
    expect(getByText("오늘 배워갈 장면")).toBeTruthy();
    expect(getByText(/자기 경력을 자랑하지 않고도/)).toBeTruthy();
    expect(queryByText("학습 목표 선언")).toBeNull();
  });

  it("renders anchor and support expression cards with prompt-shaped tabs", () => {
    const {
      getAllByLabelText,
      getAllByText,
      getByLabelText,
      getByTestId,
      getByText,
      queryByLabelText,
      queryByTestId,
      queryByText,
    } = render(
      <PremiumSessionScreen session={jonnyKimPremiumSessionFixture} />,
    );

    fireEvent.press(getByText("표현"));

    expect(getByTestId("premium-expression-card-anchor")).toBeTruthy();
    expect(getByTestId("premium-expression-card-support")).toBeTruthy();
    expect(getByText("I had the privilege of")).toBeTruthy();
    expect(getByText("Through it all")).toBeTruthy();
    expect(getByText("00:05")).toBeTruthy();
    expect(
      getByText(
        "I have had the privilege of wearing different uniforms in my life.",
      ),
    ).toBeTruthy();
    expect(
      getByText("아이 해드 더 프리빌리지 오브 → 아이 **햇**더 **프리**빌리졉"),
    ).toBeTruthy();
    expect(getByText("IPA: /aɪ hæd ðə ˈprɪvəlɪdʒ əv/")).toBeTruthy();
    expect(
      getByText("I had the privilege of working with this team."),
    ).toBeTruthy();
    expect(getAllByText("소리").length).toBeGreaterThan(0);
    expect(getAllByText("응용")).toHaveLength(1);
    expect(getAllByText("복습 저장").length).toBeGreaterThan(0);
    expect(queryByLabelText("Through it all 응용")).toBeNull();

    fireEvent.press(getAllByLabelText("I had the privilege of 응용")[0]);
    expect(
      getByTestId("premium-expression-panel-anchor-variation"),
    ).toBeTruthy();
    expect(getByText("I had the privilege of learning from her.")).toBeTruthy();
    expect(
      getByText("멘토나 선배에게 배운 경험을 격 있게 말할 때."),
    ).toBeTruthy();

    fireEvent.press(getAllByLabelText("I had the privilege of 복습 저장")[0]);
    expect(getByTestId("premium-expression-panel-anchor-save")).toBeTruthy();
    expect(getByText("have the privilege of")).toBeTruthy();
    expect(
      getByText("내 성취보다 받은 기회와 상대를 먼저 세우는 표현."),
    ).toBeTruthy();

    fireEvent.press(getByLabelText("Through it all 복습 저장"));
    expect(getByTestId("premium-expression-panel-support-save")).toBeTruthy();
    expect(getByText("through it all")).toBeTruthy();
    expect(
      queryByTestId("premium-expression-panel-support-variation"),
    ).toBeNull();
    expect(queryByText("Through it all 응용")).toBeNull();
    expect(queryByText("어원")).toBeNull();
  });

  it("toggles translations in content catch", () => {
    const { getByText, queryByText } = render(
      <PremiumSessionScreen session={jonnyKimPremiumSessionFixture} />,
    );

    fireEvent.press(getByText("듣기"));
    expect(getByText("해석 켬")).toBeTruthy();
    expect(
      getByText("오늘 여러분과 함께 이 자리에 서게 되어 정말 겸허해집니다."),
    ).toBeTruthy();

    fireEvent.press(getByText("해석 켬"));
    expect(
      queryByText("오늘 여러분과 함께 이 자리에 서게 되어 정말 겸허해집니다."),
    ).toBeNull();
    expect(
      getPremiumSessionProgress(jonnyKimPremiumSessionFixture.id),
    ).toMatchObject({
      status: "in-progress",
      lastStep: "content-catch",
    });
  });

  it("connects the video hero controls to step navigation and captions", () => {
    const { getAllByText, getByLabelText, getByTestId, queryByText } = render(
      <PremiumSessionScreen session={jonnyKimPremiumSessionFixture} />,
    );

    fireEvent.press(getByLabelText("다음 단계"));
    expect(getAllByText("영상 시청하기").length).toBeGreaterThan(0);
    expect(
      queryByText("오늘 여러분과 함께 이 자리에 서게 되어 정말 겸허해집니다."),
    ).toBeTruthy();

    fireEvent.press(getByLabelText("해석 표시 전환"));
    expect(
      queryByText("오늘 여러분과 함께 이 자리에 서게 되어 정말 겸허해집니다."),
    ).toBeNull();

    fireEvent.press(getByLabelText("이전 단계"));
    expect(getByTestId("premium-article-reader")).toBeTruthy();
  });

  it("renders delivery analysis on the transcript line that owns the analysis", () => {
    const { getByTestId, getByText } = render(
      <PremiumSessionScreen session={jonnyKimPremiumSessionFixture} />,
    );

    fireEvent.press(getByText("분석"));

    expect(getByTestId("premium-delivery-analysis")).toBeTruthy();
    expect(
      getByText(
        "I have had the privilege of wearing different uniforms in my life.",
      ),
    ).toBeTruthy();
    expect(
      getByText(
        "경력을 나열하는 대신 받은 기회처럼 말해서 듣는 사람의 경계심을 낮춰요.",
      ),
    ).toBeTruthy();
    expect(
      getByText("I have had를 빠르게 묶고 privilege에서만 짧게 무게를 주세요."),
    ).toBeTruthy();
  });

  it("renders the roleplay sequence as start, listen, speak, analysis", async () => {
    mockRecorder = {
      ...mockRecorder,
      audioUri: "file://recording.m4a",
      duration: 3,
    };
    mockRequestPronunciationAnalysis.mockResolvedValue({
      analysis_id: "analysis-1",
      status: "queued",
      provider: "azure",
      provider_locale: "en-US",
    });
    mockWaitForPronunciationAnalysisCompletion.mockResolvedValue({
      analysis_id: "analysis-1",
      status: "complete",
      provider: "azure",
      provider_locale: "en-US",
      result: {
        status: "complete",
        provider: "azure",
        reference_text:
          jonnyKimPremiumSessionFixture.roleplay.analysis_reference_text,
        overall_score: 88,
        summary: "강세와 끝맺음이 안정적이에요.",
        pacing_note: "문장 중간 속도는 안정적이에요.",
        chunking_note: "I had the privilege of를 한 덩어리로 묶어보세요.",
        stress_note: "privilege에 가장 또렷한 힘을 주세요.",
        ending_tone_note: "bar를 급하게 닫지 마세요.",
        clarity_note: "refused의 끝 자음을 조금 더 분리해보세요.",
        word_issues: [
          {
            word: "privilege",
            error_type: "stress",
            accuracy_score: 76,
          },
        ],
      },
    });

    const { getByText, getByTestId } = render(
      <PremiumSessionScreen session={jonnyKimPremiumSessionFixture} />,
    );

    fireEvent.press(getByText("말하기"));
    expect(getByTestId("premium-roleplay-start")).toBeTruthy();

    fireEvent.press(getByText("시작하기"));
    expect(getByTestId("premium-roleplay-listen")).toBeTruthy();

    fireEvent.press(getByText("내 차례로 이동"));
    expect(getByText("답변 녹음")).toBeTruthy();
    expect(getByTestId("premium-roleplay-speak-expression-cues")).toBeTruthy();
    expect(
      getByText("아이 해드 더 프리빌리지 오브 → 아이 **햇**더 **프리**빌리졉"),
    ).toBeTruthy();
    expect(
      getByText("I had the privilege of working with this team."),
    ).toBeTruthy();

    fireEvent.press(getByText("Azure 분석 요청"));

    await waitFor(() => {
      expect(getByText("Azure 발음 분석 결과")).toBeTruthy();
      expect(
        getByTestId("premium-roleplay-analysis-expression-cues"),
      ).toBeTruthy();
      expect(
        getByTestId("premium-roleplay-pronunciation-coaching"),
      ).toBeTruthy();
      expect(getByText("속도")).toBeTruthy();
      expect(getByText("문장 중간 속도는 안정적이에요.")).toBeTruthy();
      expect(getByText("끊어 읽기")).toBeTruthy();
      expect(
        getByText("I had the privilege of를 한 덩어리로 묶어보세요."),
      ).toBeTruthy();
      expect(getByText("강세")).toBeTruthy();
      expect(getByText("privilege에 가장 또렷한 힘을 주세요.")).toBeTruthy();
      expect(getByText("끝맺음")).toBeTruthy();
      expect(getByText("bar를 급하게 닫지 마세요.")).toBeTruthy();
      expect(getByText("명료도")).toBeTruthy();
      expect(
        getByText("refused의 끝 자음을 조금 더 분리해보세요."),
      ).toBeTruthy();
      expect(getByText("privilege 76점 · stress")).toBeTruthy();
      expect(mockRequestPronunciationAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: null,
          premiumSessionId: jonnyKimPremiumSessionFixture.id,
          sentenceId: `${jonnyKimPremiumSessionFixture.id}-roleplay`,
          source: "premium-roleplay",
        }),
      );
    });
  });

  it("keeps roleplay script and translation toggles inside the listen stage", () => {
    const { getByLabelText, getByTestId, getByText, queryByText } = render(
      <PremiumSessionScreen session={jonnyKimPremiumSessionFixture} />,
    );

    fireEvent.press(getByText("말하기"));
    fireEvent.press(getByText("시작하기"));

    expect(getByTestId("premium-roleplay-listen")).toBeTruthy();
    expect(getByText("Hidden Script")).toBeTruthy();
    expect(queryByText("답변 녹음")).toBeNull();

    fireEvent.press(getByLabelText("롤플레잉 스크립트 표시 전환"));
    expect(
      getByText(
        "I had the privilege of working with a team that refused to lower the bar.",
      ),
    ).toBeTruthy();
    expect(getByTestId("premium-roleplay-listen")).toBeTruthy();
    expect(queryByText("답변 녹음")).toBeNull();

    fireEvent.press(getByLabelText("롤플레잉 해석 표시 전환"));
    expect(
      getByText("기준을 낮추지 않는 팀과 함께 일할 수 있어 영광이었어요."),
    ).toBeTruthy();
    expect(getByTestId("premium-roleplay-listen")).toBeTruthy();
    expect(queryByText("답변 녹음")).toBeNull();
  });

  it("persists expression assets on completion", async () => {
    const { getByText } = render(
      <PremiumSessionScreen session={jonnyKimPremiumSessionFixture} />,
    );

    fireEvent.press(getByText("완료"));

    await waitFor(() => {
      expect(mockPersistPremiumCompletionAssets).toHaveBeenCalledWith(
        "user-1",
        jonnyKimPremiumSessionFixture,
      );
      expect(getByText("2개의 표현이 복습 자산으로 저장됐어요.")).toBeTruthy();
      expect(
        getPremiumSessionProgress(jonnyKimPremiumSessionFixture.id),
      ).toMatchObject({
        status: "completed",
        lastStep: "completion",
        savedExpressionCount: 2,
      });
    });
  });

  it("records zero saved expressions when completion persistence fails", async () => {
    mockPersistPremiumCompletionAssets.mockRejectedValueOnce(
      new Error("save failed"),
    );
    const { getByText } = render(
      <PremiumSessionScreen session={jonnyKimPremiumSessionFixture} />,
    );

    fireEvent.press(getByText("완료"));

    await waitFor(() => {
      expect(getByText("0개의 표현이 복습 자산으로 저장됐어요.")).toBeTruthy();
      expect(
        getPremiumSessionProgress(jonnyKimPremiumSessionFixture.id),
      ).toMatchObject({
        status: "completed",
        lastStep: "completion",
        savedExpressionCount: 0,
      });
    });
  });
});
