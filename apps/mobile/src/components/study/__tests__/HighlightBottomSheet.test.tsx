// TDD: Specification tests for HighlightBottomSheet
// SPEC-MOBILE-005 - REQ-E-007, REQ-E-008, REQ-C-001
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import HighlightBottomSheet from "../HighlightBottomSheet";
import type { Sentence } from "@inputenglish/shared";

const mockSentence: Sentence = {
  id: "sent-001",
  text: "The quick brown fox jumps over the lazy dog.",
  startTime: 0,
  endTime: 4,
  highlights: [],
};

const baseProps = {
  visible: true,
  sentence: mockSentence,
  saving: false,
  onSave: jest.fn(),
  onClose: jest.fn(),
};

describe("HighlightBottomSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should display the selected sentence text", () => {
    const { getByDisplayValue } = render(
      <HighlightBottomSheet {...baseProps} />,
    );
    expect(
      getByDisplayValue("The quick brown fox jumps over the lazy dog."),
    ).toBeTruthy();
  });

  it("should call onSave with current note when save button is pressed", () => {
    const onSave = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <HighlightBottomSheet {...baseProps} onSave={onSave} />,
    );
    fireEvent.changeText(
      getByPlaceholderText("메모를 남겨보세요"),
      "Test note",
    );
    fireEvent.press(getByText("전체 문장 저장"));
    expect(onSave).toHaveBeenCalledWith("Test note", undefined);
  });

  it("should call onSave with empty string if no note entered", () => {
    const onSave = jest.fn();
    const { getByText } = render(
      <HighlightBottomSheet {...baseProps} onSave={onSave} />,
    );
    fireEvent.press(getByText("전체 문장 저장"));
    expect(onSave).toHaveBeenCalledWith("", undefined);
  });

  it("should show loading state when saving is true", () => {
    const { getByText } = render(
      <HighlightBottomSheet {...baseProps} saving={true} />,
    );
    expect(getByText("저장 중...")).toBeTruthy();
  });

  it("should disable save button when saving is true", () => {
    const onSave = jest.fn();
    const { getByText } = render(
      <HighlightBottomSheet {...baseProps} saving={true} onSave={onSave} />,
    );
    fireEvent.press(getByText("저장 중..."));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("should not render when visible is false", () => {
    const { queryByText } = render(
      <HighlightBottomSheet {...baseProps} visible={false} />,
    );
    expect(queryByText("선택한 문장")).toBeNull();
  });

  it("should render null sentence text gracefully", () => {
    const { getByPlaceholderText } = render(
      <HighlightBottomSheet {...baseProps} sentence={null} />,
    );
    expect(getByPlaceholderText("메모를 남겨보세요")).toBeTruthy();
  });
});
