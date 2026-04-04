import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockRouterPush = jest.fn();

const mockSessions = [
  {
    id: "session-1",
    source_video_id: "video-1",
    title: "OpenAI 데모로 배우는 지표 설명",
    description: "성과 공유에서 숫자를 설명하는 법",
    duration: 180,
    difficulty: "intermediate" as const,
    thumbnail_url: "",
    order_index: 0,
    source_type: "demo" as const,
    speaking_function: "explain-metric" as const,
    role_relevance: ["pm", "engineer"] as const,
    premium_required: true,
    channel_name: "OpenAI",
  },
  {
    id: "session-2",
    source_video_id: "video-2",
    title: "Quarterly Wrap-up Podcast",
    description: "핵심 업데이트를 짧게 요약하는 법",
    duration: 240,
    difficulty: "advanced" as const,
    thumbnail_url: "",
    order_index: 1,
    source_type: "podcast" as const,
    speaking_function: "summarize" as const,
    role_relevance: ["marketer"] as const,
    premium_required: false,
    channel_name: "Business Daily",
  },
];

jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

jest.mock("../../src/lib/api", () => ({
  fetchLearningSessions: jest.fn().mockResolvedValue(mockSessions),
}));

describe("HomeScreen professional discovery flow", () => {
  const HomeScreen = require("../../app/(tabs)/index").default;

  beforeEach(() => {
    mockRouterPush.mockClear();
  });

  it("shows featured + category cards and navigates to study with session id", async () => {
    const { findAllByText, findByText, getByText } = render(<HomeScreen />);

    expect(await findByText("OpenAI 데모로 배우는 지표 설명")).toBeTruthy();
    expect(
      (await findAllByText("Quarterly Wrap-up Podcast")).length,
    ).toBeGreaterThan(0);
    expect(await findByText("팟캐스트")).toBeTruthy();

    fireEvent.press(getByText("OpenAI 데모로 배우는 지표 설명"));
    fireEvent.press((await findAllByText("Quarterly Wrap-up Podcast"))[0]);

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenNthCalledWith(
        1,
        "/study/video-1?sessionId=session-1",
      );
      expect(mockRouterPush).toHaveBeenNthCalledWith(
        2,
        "/study/video-2?sessionId=session-2",
      );
    });
  });
});
