import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockLoadUserData = jest.fn().mockResolvedValue(undefined);
const mockGetVideo = jest.fn();
const mockRemoveSavedSentence = jest.fn();
const mockRemoveHighlight = jest.fn();
const mockUpdatePlaybookEntryMastery = jest.fn().mockResolvedValue(undefined);

const mockPlaybookEntries = [
  {
    id: "entry-1",
    session_id: "session-1",
    source_video_id: "video-1",
    source_sentence:
      "Revenue momentum improved significantly after the launch.",
    speaking_function: "explain-metric" as const,
    practice_mode: "slot-in" as const,
    user_rewrite:
      "Revenue momentum improved by 18% after the launch, which raised our baseline.",
    attempt_metadata: {},
    mastery_status: "new" as const,
    created_at: "2026-03-14T12:00:00.000Z",
    updated_at: "2026-03-14T12:00:00.000Z",
  },
  {
    id: "entry-2",
    session_id: "session-2",
    source_video_id: "video-2",
    source_sentence: "The main takeaway is that the rollout is on schedule.",
    speaking_function: "summarize" as const,
    practice_mode: "role-play" as const,
    user_rewrite:
      "The rollout is on schedule, and the team is ready for launch.",
    attempt_metadata: {},
    mastery_status: "practicing" as const,
    created_at: "2026-03-13T12:00:00.000Z",
    updated_at: "2026-03-13T12:00:00.000Z",
  },
];

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => {
        const cleanup = callback();
        return cleanup;
      }, [callback]);
    },
  };
});

jest.mock("../../src/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({
    user: { id: "user-1" },
    isAuthenticated: true,
    isLoading: false,
  })),
}));

jest.mock("../../src/lib/api", () => ({
  fetchPlaybookEntries: jest.fn().mockResolvedValue(mockPlaybookEntries),
  fetchLearningSessions: jest.fn().mockResolvedValue([
    { id: "session-1", title: "지표 설명 세션" },
    { id: "session-2", title: "핵심 요약 세션" },
  ]),
  updatePlaybookEntryMastery: (...args: unknown[]) =>
    mockUpdatePlaybookEntryMastery(...args),
}));

jest.mock("../../src/lib/stores", () => ({
  appStore: jest.fn((selector) =>
    selector({
      savedSentences: [],
      highlights: [],
      getVideo: mockGetVideo,
      loadUserData: mockLoadUserData,
      removeSavedSentence: mockRemoveSavedSentence,
      removeHighlight: mockRemoveHighlight,
    }),
  ),
}));

describe("ArchiveScreen playbook flow", () => {
  const ArchiveScreen = require("../../app/(tabs)/archive").default;

  beforeEach(() => {
    mockLoadUserData.mockClear();
    mockUpdatePlaybookEntryMastery.mockClear();
  });

  it("filters playbook entries by speaking function and updates mastery status", async () => {
    const { findAllByText, findByText } = render(<ArchiveScreen />);

    fireEvent.press(await findByText("플레이북"));

    expect(
      await findByText(
        "Revenue momentum improved by 18% after the launch, which raised our baseline.",
      ),
    ).toBeTruthy();
    expect(
      await findByText(
        "The rollout is on schedule, and the team is ready for launch.",
      ),
    ).toBeTruthy();

    fireEvent.press(await findByText("새로 저장"));
    fireEvent.press((await findAllByText("연습 중"))[0]);

    await waitFor(() => {
      expect(mockUpdatePlaybookEntryMastery).toHaveBeenCalledWith(
        "user-1",
        "entry-1",
        "practicing",
      );
    });
  });
});
