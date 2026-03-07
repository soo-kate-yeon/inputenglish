// RED phase: Specification tests for ShadowingHeader component
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ShadowingHeader from "../ShadowingHeader";

// Mock expo-router
jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
}));

const baseProps = {
  title: "Test Video Title",
  mode: "sentence" as const,
  onModeChange: jest.fn(),
  onExit: jest.fn(),
};

describe("ShadowingHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render the title", () => {
    const { getByText } = render(<ShadowingHeader {...baseProps} />);
    expect(getByText("Test Video Title")).toBeTruthy();
  });

  it("should render all three mode buttons", () => {
    const { getByText } = render(<ShadowingHeader {...baseProps} />);
    expect(getByText("문장")).toBeTruthy();
    expect(getByText("문단")).toBeTruthy();
    expect(getByText("전체")).toBeTruthy();
  });

  it("should call onModeChange with sentence when 문장 is pressed", () => {
    const onModeChange = jest.fn();
    const { getByText } = render(
      <ShadowingHeader {...baseProps} onModeChange={onModeChange} />,
    );
    fireEvent.press(getByText("문장"));
    expect(onModeChange).toHaveBeenCalledWith("sentence");
  });

  it("should call onModeChange with paragraph when 문단 is pressed", () => {
    const onModeChange = jest.fn();
    const { getByText } = render(
      <ShadowingHeader {...baseProps} onModeChange={onModeChange} />,
    );
    fireEvent.press(getByText("문단"));
    expect(onModeChange).toHaveBeenCalledWith("paragraph");
  });

  it("should call onModeChange with total when 전체 is pressed", () => {
    const onModeChange = jest.fn();
    const { getByText } = render(
      <ShadowingHeader {...baseProps} onModeChange={onModeChange} />,
    );
    fireEvent.press(getByText("전체"));
    expect(onModeChange).toHaveBeenCalledWith("total");
  });

  it("should render exit button", () => {
    const { getByText } = render(<ShadowingHeader {...baseProps} />);
    expect(getByText("학습 종료")).toBeTruthy();
  });

  it("should call onExit when exit button is pressed", () => {
    const onExit = jest.fn();
    const { getByText } = render(
      <ShadowingHeader {...baseProps} onExit={onExit} />,
    );
    fireEvent.press(getByText("학습 종료"));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
