import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import PremiumSessionScreen from "../PremiumSessionScreen";
import { jonnyKimPremiumSessionFixture } from "@/fixtures/premium-session";
import {
  clearPremiumSessionProgress,
  getPremiumSessionProgress,
} from "@/lib/premium-session-progress";

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

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({ user: { id: "user-1" } })),
}));

describe("PremiumSessionScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
