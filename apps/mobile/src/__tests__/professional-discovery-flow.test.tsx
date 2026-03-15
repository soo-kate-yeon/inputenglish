import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

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
  router: { push: jest.fn() },
}));

jest.mock("../../src/lib/api", () => ({
  fetchLearningSessions: jest.fn().mockResolvedValue(mockSessions),
}));

describe("HomeScreen professional discovery flow", () => {
  const HomeScreen = require("../../app/(tabs)/index").default;

  it("shows professional metadata and filters sessions by function and source type", async () => {
    const { findAllByText, findByText, getAllByText, getByText, queryByText } =
      render(<HomeScreen />);

    expect(await findByText("OpenAI 데모로 배우는 지표 설명")).toBeTruthy();
    expect(await findByText("Quarterly Wrap-up Podcast")).toBeTruthy();
    expect(getAllByText("지표 설명").length).toBeGreaterThan(0);
    expect(getAllByText("데모").length).toBeGreaterThan(0);
    expect(await findByText("프리미엄")).toBeTruthy();

    fireEvent.press(getByText("말하기 목적"));
    fireEvent.press((await findAllByText("지표 설명"))[0]);

    await waitFor(() => {
      expect(queryByText("OpenAI 데모로 배우는 지표 설명")).toBeTruthy();
      expect(queryByText("Quarterly Wrap-up Podcast")).toBeNull();
    });

    fireEvent.press(getByText("콘텐츠 형식"));
    fireEvent.press((await findAllByText("팟캐스트"))[0]);

    await waitFor(() => {
      expect(queryByText("조건에 맞는 세션이 없어요")).toBeTruthy();
    });

    fireEvent.press(getByText("지표 설명"));
    fireEvent.press((await findAllByText("전체"))[0]);

    await waitFor(() => {
      expect(queryByText("OpenAI 데모로 배우는 지표 설명")).toBeNull();
      expect(queryByText("Quarterly Wrap-up Podcast")).toBeTruthy();
    });
  });
});
