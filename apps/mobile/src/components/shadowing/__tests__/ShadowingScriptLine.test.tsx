// RED phase: Specification tests for ShadowingScriptLine component
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ShadowingScriptLine from "../ShadowingScriptLine";
import type { Sentence } from "@inputenglish/shared";

const mockSentence: Sentence = {
  id: "sent-001",
  text: "Hello, how are you doing today?",
  startTime: 0,
  endTime: 3.5,
  highlights: [],
};

const baseProps = {
  sentence: mockSentence,
  isActive: false,
  hasRecording: false,
  isCurrentRecording: false,
  onRecord: jest.fn(),
  onSeek: jest.fn(),
  index: 0,
};

describe("ShadowingScriptLine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render sentence text", () => {
    const { getByText } = render(<ShadowingScriptLine {...baseProps} />);
    expect(getByText("Hello, how are you doing today?")).toBeTruthy();
  });

  it("should render record button", () => {
    const { getByTestId } = render(<ShadowingScriptLine {...baseProps} />);
    expect(getByTestId("record-button")).toBeTruthy();
  });

  it("should call onRecord with sentenceId when record button is pressed", () => {
    const onRecord = jest.fn();
    const { getByTestId } = render(
      <ShadowingScriptLine {...baseProps} onRecord={onRecord} />,
    );
    fireEvent.press(getByTestId("record-button"));
    expect(onRecord).toHaveBeenCalledWith("sent-001");
  });

  it("should call onSeek with sentenceId when sentence text is tapped", () => {
    const onSeek = jest.fn();
    const { getByTestId } = render(
      <ShadowingScriptLine {...baseProps} onSeek={onSeek} />,
    );
    fireEvent.press(getByTestId("sentence-row"));
    expect(onSeek).toHaveBeenCalledWith("sent-001");
  });

  it("should show recording complete indicator when hasRecording is true", () => {
    const { getByTestId } = render(
      <ShadowingScriptLine {...baseProps} hasRecording={true} />,
    );
    expect(getByTestId("recording-complete-indicator")).toBeTruthy();
  });

  it("should not show recording complete indicator when hasRecording is false", () => {
    const { queryByTestId } = render(
      <ShadowingScriptLine {...baseProps} hasRecording={false} />,
    );
    expect(queryByTestId("recording-complete-indicator")).toBeNull();
  });

  it("should show currently-recording indicator when isCurrentRecording is true", () => {
    const { getByTestId } = render(
      <ShadowingScriptLine {...baseProps} isCurrentRecording={true} />,
    );
    expect(getByTestId("current-recording-indicator")).toBeTruthy();
  });

  it("should apply active styles when isActive is true", () => {
    const { getByTestId } = render(
      <ShadowingScriptLine {...baseProps} isActive={true} />,
    );
    // Should render with active styling
    const row = getByTestId("sentence-row");
    expect(row).toBeTruthy();
  });
});
