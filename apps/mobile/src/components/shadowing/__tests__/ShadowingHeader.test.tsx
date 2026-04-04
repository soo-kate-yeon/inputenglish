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

  it("should render all three mode buttons", () => {
    const { getByText } = render(<ShadowingHeader {...baseProps} />);
    expect(getByText("SENTENCE")).toBeTruthy();
    expect(getByText("PARAGRAPH")).toBeTruthy();
    expect(getByText("TOTAL")).toBeTruthy();
  });

  it("should call onModeChange with sentence when SENTENCE is pressed", () => {
    const onModeChange = jest.fn();
    const { getByText } = render(
      <ShadowingHeader {...baseProps} onModeChange={onModeChange} />,
    );
    fireEvent.press(getByText("SENTENCE"));
    expect(onModeChange).toHaveBeenCalledWith("sentence");
  });

  it("should call onModeChange with paragraph when PARAGRAPH is pressed", () => {
    const onModeChange = jest.fn();
    const { getByText } = render(
      <ShadowingHeader {...baseProps} onModeChange={onModeChange} />,
    );
    fireEvent.press(getByText("PARAGRAPH"));
    expect(onModeChange).toHaveBeenCalledWith("paragraph");
  });

  it("should call onModeChange with total when TOTAL is pressed", () => {
    const onModeChange = jest.fn();
    const { getByText } = render(
      <ShadowingHeader {...baseProps} onModeChange={onModeChange} />,
    );
    fireEvent.press(getByText("TOTAL"));
    expect(onModeChange).toHaveBeenCalledWith("total");
  });
});
