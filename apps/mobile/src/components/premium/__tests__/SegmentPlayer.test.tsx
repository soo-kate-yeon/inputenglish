import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import SegmentPlayer from "../SegmentPlayer";
import type { VideoSegment } from "@inputenglish/shared";

// Mock YouTubePlayer
jest.mock("../../player/YouTubePlayer", () => {
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

// Mock premium-transcript-sync (already a pure function — no need for heavy mock)
jest.mock("../../../lib/premium-transcript-sync", () => ({
  findPremiumActiveTranscriptLine: jest.fn(() => null),
  getPremiumTranscriptScrollIndex: jest.fn(() => 0),
  PREMIUM_TRANSCRIPT_SYNC_INTERVAL_MS: 100,
}));

const mockSegment: VideoSegment = {
  id: "seg-001",
  parentVideoId: "dQw4w9WgXcQ",
  channelId: "chan-001",
  startTime: 30,
  endTime: 90,
  transcript: [
    { start: 30, end: 45, text: "Hello everyone" },
    { start: 45, end: 60, text: "today we explore" },
    { start: 60, end: 75, text: "the universe together" },
  ],
  wpm: 120,
  bandCoverage: {
    beginner: 0.8,
    basic: 0.1,
    conversation: 0.07,
    professional: 0.03,
  },
  topicTags: ["science"],
  selfContained: true,
  difficultyScore: 2,
  createdAt: "2026-06-15T00:00:00Z",
};

describe("SegmentPlayer", () => {
  it("renders without crashing and shows the YouTubePlayer", () => {
    const onWordTap = jest.fn();
    const onEnd = jest.fn();
    const { getByTestId } = render(
      <SegmentPlayer
        segment={mockSegment}
        onWordTap={onWordTap}
        onEnd={onEnd}
      />,
    );
    expect(getByTestId("youtube-player")).toBeTruthy();
  });

  it("renders transcript words from the segment", () => {
    const onWordTap = jest.fn();
    const onEnd = jest.fn();
    const { getAllByText } = render(
      <SegmentPlayer
        segment={mockSegment}
        onWordTap={onWordTap}
        onEnd={onEnd}
      />,
    );
    // Words are rendered individually per word-tap design
    expect(getAllByText("Hello").length).toBeGreaterThan(0);
    expect(getAllByText("everyone").length).toBeGreaterThan(0);
    expect(getAllByText("today").length).toBeGreaterThan(0);
  });

  it("calls onWordTap with the lowercased word and the surrounding line context", () => {
    const onWordTap = jest.fn();
    const onEnd = jest.fn();
    const { getAllByText } = render(
      <SegmentPlayer
        segment={mockSegment}
        onWordTap={onWordTap}
        onEnd={onEnd}
      />,
    );
    // Press "Hello" from the first transcript line → tapped line + next line.
    fireEvent.press(getAllByText("Hello")[0]);
    expect(onWordTap).toHaveBeenCalledWith(
      "hello",
      "Hello everyone today we explore",
    );
  });

  it("renders a transcript container with testID segment-transcript", () => {
    const onWordTap = jest.fn();
    const onEnd = jest.fn();
    const { getByTestId } = render(
      <SegmentPlayer
        segment={mockSegment}
        onWordTap={onWordTap}
        onEnd={onEnd}
      />,
    );
    expect(getByTestId("segment-transcript")).toBeTruthy();
  });
});
