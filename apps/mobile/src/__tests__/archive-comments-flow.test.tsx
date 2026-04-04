import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { CardComment } from "@inputenglish/shared";

const mockLoadUserData = jest.fn().mockResolvedValue(undefined);
const mockGetVideo = jest.fn();
const mockRemoveSavedSentence = jest.fn().mockResolvedValue(undefined);
const mockRemoveHighlight = jest.fn().mockResolvedValue(undefined);
const mockCreateCardComment = jest.fn();
const mockUpdateCardComment = jest.fn();
const mockDeleteCardComment = jest.fn();
const mockDeleteCardCommentsByTarget = jest.fn().mockResolvedValue(undefined);

const mockSavedSentences = [
  {
    id: "s1",
    videoId: "v1",
    sentenceId: "sent-1",
    sentenceText: "Test sentence one",
    startTime: 0,
    endTime: 5,
    createdAt: Date.now(),
  },
];

const mockComments: CardComment[] = [
  {
    id: "c1",
    targetType: "saved_sentence",
    targetId: "s1",
    body: "My first note",
    createdAt: "2026-04-01T09:00:00.000Z",
    updatedAt: "2026-04-01T09:00:00.000Z",
  },
];

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    router: { push: jest.fn() },
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
  fetchPlaybookEntries: jest.fn().mockResolvedValue([]),
  fetchLearningSessions: jest
    .fn()
    .mockResolvedValue([
      { id: "session-1", source_video_id: "v1", title: "Test Session" },
    ]),
  fetchCardComments: jest.fn().mockResolvedValue(mockComments),
  createCardComment: (...args: unknown[]) => mockCreateCardComment(...args),
  updateCardComment: (...args: unknown[]) => mockUpdateCardComment(...args),
  deleteCardComment: (...args: unknown[]) => mockDeleteCardComment(...args),
  deleteCardCommentsByTarget: (...args: unknown[]) =>
    mockDeleteCardCommentsByTarget(...args),
  updatePlaybookEntryMastery: jest.fn(),
}));

jest.mock("../../src/lib/stores", () => ({
  appStore: jest.fn((selector) =>
    selector({
      savedSentences: mockSavedSentences,
      highlights: [],
      getVideo: mockGetVideo,
      loadUserData: mockLoadUserData,
      removeSavedSentence: mockRemoveSavedSentence,
      removeHighlight: mockRemoveHighlight,
    }),
  ),
}));

describe("Archive comments flow", () => {
  const ArchiveScreen = require("../../app/(tabs)/archive").default;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateCardComment.mockResolvedValue({
      id: "c-new",
      targetType: "saved_sentence",
      targetId: "s1",
      body: "New note",
      createdAt: "2026-04-05T00:00:00Z",
      updatedAt: "2026-04-05T00:00:00Z",
    });
    mockUpdateCardComment.mockResolvedValue({
      id: "c1",
      targetType: "saved_sentence",
      targetId: "s1",
      body: "Edited note",
      createdAt: "2026-04-01T09:00:00.000Z",
      updatedAt: "2026-04-05T00:00:00Z",
    });
    mockDeleteCardComment.mockResolvedValue(undefined);
  });

  it("loads and displays comments below their respective cards", async () => {
    const { findByText } = render(<ArchiveScreen />);
    expect(await findByText("My first note")).toBeTruthy();
  });

  it("shows add trigger on each card", async () => {
    const { findAllByText } = render(<ArchiveScreen />);
    const triggers = await findAllByText("메모 추가...");
    expect(triggers.length).toBeGreaterThanOrEqual(1);
  });

  it("creates a comment optimistically", async () => {
    const { findByText, findByTestId } = render(<ArchiveScreen />);

    fireEvent.press(await findByText("메모 추가..."));
    fireEvent.changeText(await findByTestId("comment-input"), "New note");
    fireEvent.press(await findByTestId("comment-save"));

    // Optimistic: should appear immediately
    expect(await findByText("New note")).toBeTruthy();

    await waitFor(() => {
      expect(mockCreateCardComment).toHaveBeenCalledWith("user-1", {
        targetType: "saved_sentence",
        targetId: "s1",
        body: "New note",
      });
    });
  });

  it("rolls back on create failure and shows error toast", async () => {
    mockCreateCardComment.mockRejectedValueOnce(new Error("Network error"));

    const { findByText, findByTestId, queryByText } = render(<ArchiveScreen />);

    fireEvent.press(await findByText("메모 추가..."));
    fireEvent.changeText(await findByTestId("comment-input"), "Failing note");
    fireEvent.press(await findByTestId("comment-save"));

    await waitFor(() => {
      expect(queryByText("Failing note")).toBeNull();
    });

    expect(await findByText("메모 저장에 실패했습니다.")).toBeTruthy();
  });

  it("edits a comment optimistically", async () => {
    const { findByText, findByTestId } = render(<ArchiveScreen />);

    // Wait for comment to load
    await findByText("My first note");

    fireEvent.press(await findByTestId("comment-edit-c1"));
    fireEvent.changeText(await findByTestId("comment-input"), "Edited note");
    fireEvent.press(await findByTestId("comment-save"));

    expect(await findByText("Edited note")).toBeTruthy();

    await waitFor(() => {
      expect(mockUpdateCardComment).toHaveBeenCalledWith(
        "user-1",
        "c1",
        "Edited note",
      );
    });
  });

  it("deletes a comment optimistically", async () => {
    const { findByText, findByTestId, queryByText } = render(<ArchiveScreen />);

    await findByText("My first note");
    fireEvent.press(await findByTestId("comment-delete-c1"));

    await waitFor(() => {
      expect(queryByText("My first note")).toBeNull();
    });

    expect(mockDeleteCardComment).toHaveBeenCalledWith("user-1", "c1");
  });

  it("rolls back on delete failure", async () => {
    mockDeleteCardComment.mockRejectedValueOnce(new Error("Delete failed"));

    const { findByText, findByTestId } = render(<ArchiveScreen />);

    await findByText("My first note");
    fireEvent.press(await findByTestId("comment-delete-c1"));

    // Should re-appear after rollback
    expect(await findByText("My first note")).toBeTruthy();
    expect(await findByText("메모 삭제에 실패했습니다.")).toBeTruthy();
  });
});
