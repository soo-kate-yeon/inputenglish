import React from "react";
import { fireEvent, render, waitFor, act } from "@testing-library/react-native";

// Mock MMKV
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
jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn().mockResolvedValue(false),
}));

// Mock supabase
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

const mockSavePlaybookEntry = jest.fn();
const mockDeletePlaybookEntry = jest.fn();
const mockFetchPlaybookEntries = jest.fn();

const mockVideo = {
  id: "v1",
  video_id: "test-video-123",
  title: "Bookmark Test Video",
  transcript: [
    {
      id: "s1",
      text: "Revenue momentum improved significantly.",
      startTime: 0,
      endTime: 3,
      highlights: [],
    },
    {
      id: "s2",
      text: "The conversion rate stabilized.",
      startTime: 3,
      endTime: 6,
      highlights: [],
    },
  ],
  snippet_start_time: 0,
};

const mockSessionDetail = {
  id: "session-1",
  source_video_id: "test-video-123",
  title: "Bookmark Test Session",
  description: "Test session.",
  duration: 24,
  order_index: 0,
  source_type: "demo" as const,
  genre: "tech" as const,
  role_relevance: ["pm"] as const,
  premium_required: false,
  context: {
    strategic_intent: "Test intent.",
    reusable_scenarios: ["test scenario"],
    key_vocabulary: ["momentum"],
    grammar_rhetoric_note: "Test note.",
    expected_takeaway: "Test takeaway.",
  },
};

const mockTransformationSet = {
  id: "tset-1",
  session_id: "session-1",
  target_pattern: "improved significantly",
  pattern_type: "verb-adverb" as const,
  source_sentence_ids: ["s1", "s2"],
  generated_by: "ai" as const,
  created_at: "2026-04-12T00:00:00Z",
  updated_at: "2026-04-12T00:00:00Z",
  exercises: [
    {
      id: "ex-1",
      set_id: "tset-1",
      page_order: 2,
      exercise_type: "kr-to-en" as const,
      instruction_text: "Translate to English.",
      source_korean: "수익 모멘텀이 크게 개선되었다.",
      reference_answer: "Revenue momentum improved significantly.",
      created_at: "2026-04-12T00:00:00Z",
      updated_at: "2026-04-12T00:00:00Z",
    },
  ],
};

jest.mock("../../src/lib/transformation-api", () => ({
  fetchTransformationSet: jest.fn().mockResolvedValue(mockTransformationSet),
  saveTransformationAttempt: jest.fn().mockResolvedValue({ id: "attempt-1" }),
  uploadTransformationRecording: jest.fn(),
}));

jest.mock("../../src/lib/api", () => ({
  fetchCuratedVideo: jest.fn().mockResolvedValue(mockVideo),
  fetchLearningSessionDetail: jest.fn().mockResolvedValue(mockSessionDetail),
  ensurePracticePrompts: jest.fn().mockResolvedValue([]),
  savePracticeAttempt: jest.fn(),
  savePlaybookEntry: (...args: unknown[]) => mockSavePlaybookEntry(...args),
  fetchPlaybookEntries: (...args: unknown[]) =>
    mockFetchPlaybookEntries(...args),
  deletePlaybookEntry: (...args: unknown[]) => mockDeletePlaybookEntry(...args),
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

const mockRouterPush = jest.fn();

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
  getPronunciationScore: jest.fn(),
}));

jest.mock("../../src/lib/analytics", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("../../src/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({
    user: {
      id: "user-1",
      email: "test@example.com",
      user_metadata: { full_name: "Test User" },
    },
  })),
}));

jest.mock("../../src/hooks/useSubscription", () => ({
  useSubscription: jest.fn(() => ({
    plan: "PREMIUM",
    canUseAI: true,
    isLoading: false,
    refresh: jest.fn(),
  })),
}));

jest.mock("../../src/lib/recent-sessions", () => ({
  recordSessionVisit: jest.fn(),
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

describe("Bookmark toggle in transformation practice", () => {
  const StudyScreen = require("../../app/study/[videoId]").default;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPlaybookEntries.mockResolvedValue([]);
    mockSavePlaybookEntry.mockResolvedValue({
      id: "entry-real-1",
      session_id: "session-1",
      source_video_id: "test-video-123",
      source_sentence: "Revenue momentum improved significantly.",
      practice_mode: "bookmark",
      user_rewrite: "",
      attempt_metadata: {},
      mastery_status: "new",
      created_at: "2026-04-12T00:00:00Z",
      updated_at: "2026-04-12T00:00:00Z",
    });
    mockDeletePlaybookEntry.mockResolvedValue(undefined);
  });

  it("calls savePlaybookEntry with practiceMode 'bookmark' when bookmarking a sentence", async () => {
    const { findByText, getAllByText, getAllByTestId } = render(
      <StudyScreen />,
    );

    // Start study and navigate to transformation tab
    fireEvent.press(await findByText("학습 시작"));
    fireEvent.press(getAllByText("변형 연습")[0]);

    // Wait for TransformationCarousel to load and render ExpressionPage
    // The SaveToggle renders Ionicons which is mocked as a Text with "Ionicons"
    await waitFor(() => {
      // ExpressionPage shows source sentences with bookmark buttons
      expect(
        getAllByText("Revenue momentum improved significantly.").length,
      ).toBeGreaterThanOrEqual(1);
    });

    const bookmarkButtons = getAllByTestId("save-toggle");
    expect(bookmarkButtons.length).toBeGreaterThanOrEqual(1);

    // Tap the first bookmark button (sentence 1)
    await act(async () => {
      fireEvent.press(bookmarkButtons[0]);
    });

    // Verify savePlaybookEntry was called with correct params
    await waitFor(() => {
      expect(mockSavePlaybookEntry).toHaveBeenCalledWith("user-1", {
        sessionId: "session-1",
        sourceVideoId: "test-video-123",
        sourceSentence: "Revenue momentum improved significantly.",
        practiceMode: "bookmark",
        userRewrite: "",
      });
    });
  });

  it("persists bookmark state after successful save", async () => {
    const { findByText, getAllByText, getAllByTestId } = render(
      <StudyScreen />,
    );

    fireEvent.press(await findByText("학습 시작"));
    fireEvent.press(getAllByText("변형 연습")[0]);

    await waitFor(() => {
      expect(
        getAllByText("Revenue momentum improved significantly.").length,
      ).toBeGreaterThanOrEqual(1);
    });

    const bookmarkButtons = getAllByTestId("save-toggle");

    // Tap bookmark
    await act(async () => {
      fireEvent.press(bookmarkButtons[0]);
    });

    // Wait for async save to complete
    await waitFor(() => {
      expect(mockSavePlaybookEntry).toHaveBeenCalledTimes(1);
    });

    // Bookmark should still be saved (not reverted) - savePlaybookEntry succeeded
    // The SaveToggle's active prop is derived from bookmarkedEntryMap
    // After successful save, the map should contain the entry
    // Tapping again should trigger DELETE (proving state persisted)
    await act(async () => {
      fireEvent.press(bookmarkButtons[0]);
    });

    // Second tap should call deletePlaybookEntry (proving first bookmark persisted)
    await waitFor(() => {
      expect(mockDeletePlaybookEntry).toHaveBeenCalledTimes(1);
    });
  });

  it("reverts bookmark state when save fails", async () => {
    mockSavePlaybookEntry.mockRejectedValueOnce(
      new Error("check constraint violation"),
    );

    const { findByText, getAllByText, getAllByTestId } = render(
      <StudyScreen />,
    );

    fireEvent.press(await findByText("학습 시작"));
    fireEvent.press(getAllByText("변형 연습")[0]);

    await waitFor(() => {
      expect(
        getAllByText("Revenue momentum improved significantly.").length,
      ).toBeGreaterThanOrEqual(1);
    });

    const bookmarkButtons = getAllByTestId("save-toggle");

    // Tap bookmark - optimistic update should show active
    await act(async () => {
      fireEvent.press(bookmarkButtons[0]);
    });

    // Wait for the rejected promise to settle and trigger rollback
    await waitFor(() => {
      expect(mockSavePlaybookEntry).toHaveBeenCalledTimes(1);
    });

    // After failure, tapping again should attempt to SAVE again (not delete)
    // because the rollback removed the entry from bookmarkedEntryMap
    await act(async () => {
      fireEvent.press(bookmarkButtons[0]);
    });

    // Should call savePlaybookEntry again (not deletePlaybookEntry)
    await waitFor(() => {
      expect(mockSavePlaybookEntry).toHaveBeenCalledTimes(2);
    });
    expect(mockDeletePlaybookEntry).not.toHaveBeenCalled();
  });
});
