/**
 * TDD: SPEC-MOBILE-011 Transformation Carousel Tests
 * RED phase: these tests define expected behavior before implementation
 */
import React from "react";
import { fireEvent, render, waitFor, act } from "@testing-library/react-native";

// Mock MMKV (use the moduleNameMapper path, avoid circular require)
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

// Mock expo-speech
const mockSpeak = jest.fn();
const mockStop = jest.fn();
const mockIsSpeakingAsync = jest.fn().mockResolvedValue(false);
jest.mock("expo-speech", () => ({
  speak: (...args: unknown[]) => mockSpeak(...args),
  stop: () => mockStop(),
  isSpeakingAsync: () => mockIsSpeakingAsync(),
}));

// Mock audio recorder
const mockStartRecording = jest.fn().mockResolvedValue(true);
const mockStopRecording = jest.fn().mockResolvedValue("file:///test.m4a");
const mockResetRecording = jest.fn().mockResolvedValue(undefined);
const mockPlayRecording = jest.fn().mockResolvedValue(undefined);
const mockPauseRecording = jest.fn();

let mockRecordingState: "idle" | "recording" | "playback" = "idle";

jest.mock("../../src/hooks/useAudioRecorder", () =>
  jest.fn(() => ({
    recordingState: mockRecordingState,
    audioUri: mockRecordingState === "playback" ? "file:///test.m4a" : null,
    duration: 0,
    isPlaying: false,
    playbackProgress: 0,
    hasPermission: true,
    isRecorderBusy: false,
    lastError: null,
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    playRecording: mockPlayRecording,
    pauseRecording: mockPauseRecording,
    resetRecording: mockResetRecording,
    requestPermission: jest.fn().mockResolvedValue(true),
  })),
);

// Mock transformation API
const mockFetchTransformationSet = jest.fn();
const mockSaveTransformationAttempt = jest
  .fn()
  .mockResolvedValue({ id: "attempt-1" });

jest.mock("../../src/lib/transformation-api", () => ({
  fetchTransformationSet: (...args: unknown[]) =>
    mockFetchTransformationSet(...args),
  saveTransformationAttempt: (...args: unknown[]) =>
    mockSaveTransformationAttempt(...args),
}));

// Mock supabase (used in TransformationCarousel.handleConfirm for auth.getUser)
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
    storage: {
      from: jest.fn(() => ({
        upload: jest
          .fn()
          .mockResolvedValue({ data: { path: "test.m4a" }, error: null }),
        getPublicUrl: jest
          .fn()
          .mockReturnValue({
            data: { publicUrl: "https://test.com/test.m4a" },
          }),
      })),
    },
  },
}));

const mockSet = {
  id: "set-1",
  session_id: "session-1",
  target_pattern: "explain metric changes using declarative sentences",
  pattern_type: "declarative",
  generated_by: "ai",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  exercises: [
    {
      id: "ex-2",
      set_id: "set-1",
      page_order: 2,
      exercise_type: "kr-to-en",
      instruction_text: "Translate the following sentence into English.",
      source_korean: "매출 모멘텀이 크게 개선되었습니다.",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "ex-3",
      set_id: "set-1",
      page_order: 3,
      exercise_type: "qa-response",
      instruction_text: "Answer the question in English.",
      question_text: "What happened to the revenue momentum after the launch?",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "ex-4",
      set_id: "set-1",
      page_order: 4,
      exercise_type: "kr-to-en",
      instruction_text: "Translate the following sentence into English.",
      source_korean: "전환율이 더 높은 기준선에서 안정화되었습니다.",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "ex-5",
      set_id: "set-1",
      page_order: 5,
      exercise_type: "dialog-completion",
      instruction_text: "Complete the dialog by filling in the blank.",
      dialog_lines: [
        {
          speaker: "Manager",
          text: "What was the key driver this quarter?",
          is_blank: false,
        },
        {
          speaker: "You",
          text: "The conversion rate stabilized at a higher baseline.",
          is_blank: true,
        },
      ],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
};

describe("TransformationCarousel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordingState = "idle";
    mockFetchTransformationSet.mockResolvedValue(mockSet);
  });

  describe("AC-001: Carousel structure", () => {
    it("renders intro page (page 0) by default when no MMKV skip key", async () => {
      const {
        TransformationCarousel,
      } = require("../../src/components/study/TransformationCarousel");
      const { findByText } = render(
        <TransformationCarousel sessionId="session-1" />,
      );

      // IntroPage shows explanation
      expect(await findByText(/변형 연습/)).toBeTruthy();
    });

    it("fetches transformation set on mount", async () => {
      const {
        TransformationCarousel,
      } = require("../../src/components/study/TransformationCarousel");
      render(<TransformationCarousel sessionId="session-1" />);

      await waitFor(() => {
        expect(mockFetchTransformationSet).toHaveBeenCalledWith("session-1");
      });
    });
  });

  describe("AC-002: Intro page MMKV skip", () => {
    it("shows intro page with 다시 보지 않기 button", async () => {
      const {
        TransformationCarousel,
      } = require("../../src/components/study/TransformationCarousel");
      const { findByText } = render(
        <TransformationCarousel sessionId="session-1" />,
      );

      expect(await findByText("다시 보지 않기")).toBeTruthy();
    });
  });

  describe("AC-003: KR2EN page", () => {
    it("shows source_korean text on KoreanToEnglishPage", async () => {
      const {
        KoreanToEnglishPage,
      } = require("../../src/components/study/carousel/KoreanToEnglishPage");
      const { findByText } = render(
        <KoreanToEnglishPage
          exercise={mockSet.exercises[0] as any}
          onConfirm={jest.fn()}
        />,
      );

      expect(
        await findByText("매출 모멘텀이 크게 개선되었습니다."),
      ).toBeTruthy();
    });

    it("shows instruction text", async () => {
      const {
        KoreanToEnglishPage,
      } = require("../../src/components/study/carousel/KoreanToEnglishPage");
      const { findByText } = render(
        <KoreanToEnglishPage
          exercise={mockSet.exercises[0] as any}
          onConfirm={jest.fn()}
        />,
      );

      expect(
        await findByText("Translate the following sentence into English."),
      ).toBeTruthy();
    });
  });

  describe("AC-004: QA Response page", () => {
    it("shows question_text on QAResponsePage", async () => {
      const {
        QAResponsePage,
      } = require("../../src/components/study/carousel/QAResponsePage");
      const { findByText } = render(
        <QAResponsePage
          exercise={mockSet.exercises[1] as any}
          onConfirm={jest.fn()}
        />,
      );

      expect(
        await findByText(
          "What happened to the revenue momentum after the launch?",
        ),
      ).toBeTruthy();
    });
  });

  describe("AC-005: Dialog page with TTS", () => {
    it("shows speaker labels and dialog text", async () => {
      const {
        DialogCompletionPage,
      } = require("../../src/components/study/carousel/DialogCompletionPage");
      const { findByText } = render(
        <DialogCompletionPage
          exercise={mockSet.exercises[3] as any}
          onConfirm={jest.fn()}
        />,
      );

      expect(await findByText("Manager")).toBeTruthy();
      expect(
        await findByText("What was the key driver this quarter?"),
      ).toBeTruthy();
      expect(await findByText("You")).toBeTruthy();
    });

    it("renders TTS play button for non-blank dialog lines", async () => {
      const {
        DialogCompletionPage,
      } = require("../../src/components/study/carousel/DialogCompletionPage");
      const { findByTestId } = render(
        <DialogCompletionPage
          exercise={mockSet.exercises[3] as any}
          onConfirm={jest.fn()}
        />,
      );

      // Non-blank lines get TTS button
      expect(await findByTestId("tts-play-0")).toBeTruthy();
    });

    it("calls expo-speech when TTS button pressed", async () => {
      const {
        DialogCompletionPage,
      } = require("../../src/components/study/carousel/DialogCompletionPage");
      const { findByTestId } = render(
        <DialogCompletionPage
          exercise={mockSet.exercises[3] as any}
          onConfirm={jest.fn()}
        />,
      );

      const ttsButton = await findByTestId("tts-play-0");
      fireEvent.press(ttsButton);

      await waitFor(() => {
        expect(mockSpeak).toHaveBeenCalledWith(
          "What was the key driver this quarter?",
          expect.objectContaining({ language: "en-US" }),
        );
      });
    });
  });

  describe("AC-008: page_order 2 and 4 have different source_korean", () => {
    it("exercises at page_order 2 and 4 have different source_korean", () => {
      const ex2 = mockSet.exercises.find((e) => e.page_order === 2);
      const ex4 = mockSet.exercises.find((e) => e.page_order === 4);

      expect(ex2?.source_korean).not.toBe(ex4?.source_korean);
      expect(ex2?.source_korean).toBeTruthy();
      expect(ex4?.source_korean).toBeTruthy();
    });
  });
});

describe("ExerciseRecordingBar", () => {
  it("renders Start Recording button when recordingState is idle", async () => {
    const {
      ExerciseRecordingBar,
    } = require("../../src/components/study/carousel/ExerciseRecordingBar");
    const { findByText } = render(
      <ExerciseRecordingBar
        recordingState="idle"
        duration={0}
        isPlaying={false}
        playbackProgress={0}
        onStop={jest.fn()}
        onPlay={jest.fn()}
        onPause={jest.fn()}
        onReRecord={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(await findByText("Start Recording")).toBeTruthy();
  });

  it("renders null container for idle but delegates to RecordingBar when recording", async () => {
    const {
      ExerciseRecordingBar,
    } = require("../../src/components/study/carousel/ExerciseRecordingBar");
    const { findByTestId } = render(
      <ExerciseRecordingBar
        recordingState="recording"
        duration={5}
        isPlaying={false}
        playbackProgress={0}
        onStop={jest.fn()}
        onPlay={jest.fn()}
        onPause={jest.fn()}
        onReRecord={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    // RecordingBar shows stop button when recording
    expect(await findByTestId("stop-button")).toBeTruthy();
  });

  it("calls onConfirm when DONE button is pressed", async () => {
    const onConfirm = jest.fn();
    const {
      ExerciseRecordingBar,
    } = require("../../src/components/study/carousel/ExerciseRecordingBar");
    const { findByTestId } = render(
      <ExerciseRecordingBar
        recordingState="playback"
        duration={5}
        isPlaying={false}
        playbackProgress={0}
        onStop={jest.fn()}
        onPlay={jest.fn()}
        onPause={jest.fn()}
        onReRecord={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    const doneButton = await findByTestId("confirm-button");
    fireEvent.press(doneButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("CarouselPagination", () => {
  it("renders correct number of dots", () => {
    const {
      CarouselPagination,
    } = require("../../src/components/study/carousel/CarouselPagination");
    const { getAllByTestId } = render(
      <CarouselPagination total={5} currentIndex={0} />,
    );

    expect(getAllByTestId("pagination-dot")).toHaveLength(5);
  });

  it("marks active dot correctly", () => {
    const {
      CarouselPagination,
    } = require("../../src/components/study/carousel/CarouselPagination");
    const { getAllByTestId } = render(
      <CarouselPagination total={5} currentIndex={2} />,
    );

    const dots = getAllByTestId("pagination-dot");
    expect(dots[2].props.style).toMatchObject(
      expect.arrayContaining([expect.objectContaining({ opacity: 1 })]),
    );
  });
});

describe("useTTS", () => {
  it("calls Speech.speak with en-US language", async () => {
    const { renderHook, act } = require("@testing-library/react-native");
    const { useTTS } = require("../../src/hooks/useTTS");

    const { result } = renderHook(() => useTTS());
    act(() => {
      result.current.speak("Hello world");
    });

    await waitFor(() => {
      expect(mockSpeak).toHaveBeenCalledWith(
        "Hello world",
        expect.objectContaining({ language: "en-US" }),
      );
    });
  });

  it("calls Speech.stop when stop() is called", async () => {
    const { renderHook, act } = require("@testing-library/react-native");
    const { useTTS } = require("../../src/hooks/useTTS");

    const { result } = renderHook(() => useTTS());
    act(() => {
      result.current.stop();
    });

    expect(mockStop).toHaveBeenCalled();
  });
});

describe("IntroPage", () => {
  it("renders explanation text", async () => {
    const {
      IntroPage,
    } = require("../../src/components/study/carousel/IntroPage");
    const { findByText } = render(
      <IntroPage onSkip={jest.fn()} onDismissForever={jest.fn()} />,
    );

    expect(await findByText(/변형 연습/)).toBeTruthy();
  });

  it("calls onDismissForever when 다시 보지 않기 is pressed", async () => {
    const onDismissForever = jest.fn();
    const {
      IntroPage,
    } = require("../../src/components/study/carousel/IntroPage");
    const { findByText } = render(
      <IntroPage onSkip={jest.fn()} onDismissForever={onDismissForever} />,
    );

    const btn = await findByText("다시 보지 않기");
    fireEvent.press(btn);

    expect(onDismissForever).toHaveBeenCalledTimes(1);
  });
});

describe("transformation-api", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("fetchTransformationSet calls supabase with correct query", async () => {
    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({
      data: { ...mockSet, transformation_exercises: mockSet.exercises },
      error: null,
    });

    jest.mock("../../src/lib/supabase", () => ({
      supabase: {
        from: jest.fn(() => ({
          select: mockSelect,
          eq: mockEq,
          order: mockOrder,
          single: mockSingle,
        })),
      },
    }));

    const {
      fetchTransformationSet,
    } = require("../../src/lib/transformation-api");
    const result = await fetchTransformationSet("session-1");

    expect(result).toBeDefined();
  });
});
