import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

let mockPlan: "FREE" | "PREMIUM" = "PREMIUM";
const mockRouterPush = jest.fn();
const mockSavePlaybookEntry = jest.fn().mockResolvedValue({
  id: "entry-1",
});
const mockSavePracticeAttempt = jest.fn().mockResolvedValue({
  id: "attempt-1",
});

const mockSessionDetail = {
  id: "session-1",
  source_video_id: "test-video-123",
  title: "Professional Update Session",
  description: "Explain momentum with a calm business tone.",
  duration: 24,
  order_index: 0,
  source_type: "demo" as const,
  speaking_function: "explain-metric" as const,
  role_relevance: ["pm"] as const,
  premium_required: false,
  context: {
    strategic_intent: "Explain why the metric changed and what it means next.",
    speaking_function: "explain-metric" as const,
    reusable_scenarios: ["weekly business review", "stakeholder update"],
    key_vocabulary: ["momentum", "conversion"],
    grammar_rhetoric_note: "Stay observational before making a claim.",
    expected_takeaway: "Turn a metric update into a business implication.",
  },
};

const mockPrompts = [
  {
    id: "prompt-1",
    session_id: "session-1",
    mode: "slot-in" as const,
    title: "Pattern Slot-in",
    prompt_text: "Reuse the structure and swap the business details.",
    guidance: ["Keep the pattern", "Change the numbers"],
  },
  {
    id: "prompt-2",
    session_id: "session-1",
    mode: "role-play" as const,
    title: "Role-Play Response",
    prompt_text: "Reply to a stakeholder asking what changed.",
    guidance: ["Lead with the main point"],
  },
  {
    id: "prompt-3",
    session_id: "session-1",
    mode: "my-briefing" as const,
    title: "My Briefing",
    prompt_text: "Write your own internal update.",
    guidance: ["Keep it short"],
  },
];

const mockVideo = {
  id: "v1",
  video_id: "test-video-123",
  title: "Test Study Video",
  transcript: [
    {
      id: "s1",
      text: "Revenue momentum improved significantly after the launch.",
      startTime: 0,
      endTime: 3,
      highlights: [],
    },
    {
      id: "s2",
      text: "The conversion rate then stabilized at a higher baseline.",
      startTime: 3,
      endTime: 6,
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
  ensurePracticePrompts: jest.fn().mockResolvedValue(mockPrompts),
  savePracticeAttempt: (...args: unknown[]) => mockSavePracticeAttempt(...args),
  savePlaybookEntry: (...args: unknown[]) => mockSavePlaybookEntry(...args),
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
  getPronunciationScore: jest.fn(),
}));

jest.mock("../../src/lib/analytics", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("../../src/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({
    user: {
      id: "user-1",
      email: "pm@example.com",
      user_metadata: { full_name: "PM Kim" },
    },
  })),
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
    (_props: object, _ref: React.Ref<unknown>) =>
      React.createElement(View, { testID: "youtube-player" }),
  );
  MockPlayer.displayName = "YouTubePlayer";
  return { __esModule: true, default: MockPlayer };
});

describe("StudyScreen transformation flow", () => {
  const StudyScreen = require("../../app/study/[videoId]").default;

  beforeEach(() => {
    mockPlan = "PREMIUM";
    mockRouterPush.mockClear();
    mockSavePlaybookEntry.mockClear();
    mockSavePracticeAttempt.mockClear();
  });

  it("shows three transformation modes for PREMIUM and saves slot-in rewrites to playbook", async () => {
    const { findByText, getByText, getByTestId } = render(<StudyScreen />);

    fireEvent.press(await findByText("START LEARNING"));
    fireEvent.press(getByText("TRANSFORM"));

    expect(await findByText("PATTERN SLOT-IN")).toBeTruthy();
    expect(await findByText("ROLE-PLAY RESPONSE")).toBeTruthy();
    expect(await findByText("MY BRIEFING")).toBeTruthy();

    fireEvent.changeText(
      getByTestId("practice-draft-input"),
      "Revenue momentum improved by 18% after the launch, which gave us a healthier baseline.",
    );

    fireEvent.press(getByText("SAVE TO PLAYBOOK"));

    await waitFor(() => {
      expect(mockSavePlaybookEntry).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          sessionId: "session-1",
          sourceVideoId: "test-video-123",
          practiceMode: "slot-in",
          sourceSentence:
            "Revenue momentum improved significantly after the launch.",
          userRewrite:
            "Revenue momentum improved by 18% after the launch, which gave us a healthier baseline.",
        }),
      );
    });

    expect(
      await findByText(
        "Saved to Playbook. Archive > Playbook에서 다시 볼 수 있어요.",
      ),
    ).toBeTruthy();
  });

  it("sends FREE users to paywall when they try to open transformation practice", async () => {
    mockPlan = "FREE";

    const { findByText, getByText } = render(<StudyScreen />);

    fireEvent.press(await findByText("START LEARNING"));
    fireEvent.press(getByText("TRANSFORM"));

    expect(mockRouterPush).toHaveBeenCalledWith("/paywall");
  });
});
