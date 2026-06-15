import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import type { PlaybookEntry } from "@inputenglish/shared";
import PlaybookCard from "../components/study/PlaybookCard";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

const entry: PlaybookEntry = {
  id: "playbook-1",
  session_id: "legacy-session-1",
  source_video_id: "video-1",
  source_sentence: "I had the privilege of working with this team.",
  practice_mode: "bookmark",
  user_rewrite: "I had the privilege of leading this launch.",
  attempt_metadata: {
    premiumSessionId: "premium-session-1",
  },
  mastery_status: "new",
  created_at: "2026-06-14T00:00:00.000Z",
  updated_at: "2026-06-14T00:00:00.000Z",
};

describe("PlaybookCard premium routing", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("opens the premium session associated with saved premium expressions", () => {
    const { getByText } = render(
      <PlaybookCard
        entry={entry}
        sessionTitle="Jonny Kim의 Harvard Alumni Day 연설"
        onSetMastery={jest.fn()}
      />,
    );

    fireEvent.press(getByText("Jonny Kim의 Harvard Alumni Day 연설"));

    expect(mockPush).toHaveBeenCalledWith("/premium/premium-session-1");
  });
});
