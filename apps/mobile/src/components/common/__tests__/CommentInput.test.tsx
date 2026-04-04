import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  const MockIcon = (props: { name: string; testID?: string }) => (
    <Text testID={props.testID}>{props.name}</Text>
  );
  return { Ionicons: MockIcon };
});

describe("CommentInput", () => {
  const CommentInput = require("../CommentInput").default;

  const defaultProps = {
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders TextInput with placeholder text", () => {
    const { getByPlaceholderText } = render(<CommentInput {...defaultProps} />);
    expect(getByPlaceholderText("메모 추가...")).toBeTruthy();
  });

  it("calls onSave with trimmed text when save is pressed", () => {
    const onSave = jest.fn();
    const { getByTestId } = render(
      <CommentInput {...defaultProps} onSave={onSave} />,
    );

    fireEvent.changeText(getByTestId("comment-input"), "Hello world  ");
    fireEvent.press(getByTestId("comment-save"));

    expect(onSave).toHaveBeenCalledWith("Hello world");
  });

  it("does NOT call onSave when text is empty", () => {
    const onSave = jest.fn();
    const { getByTestId } = render(
      <CommentInput {...defaultProps} onSave={onSave} />,
    );

    fireEvent.press(getByTestId("comment-save"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does NOT call onSave when text is only whitespace", () => {
    const onSave = jest.fn();
    const { getByTestId } = render(
      <CommentInput {...defaultProps} onSave={onSave} />,
    );

    fireEvent.changeText(getByTestId("comment-input"), "   ");
    fireEvent.press(getByTestId("comment-save"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onCancel when input loses focus", () => {
    const onCancel = jest.fn();
    const { getByTestId } = render(
      <CommentInput {...defaultProps} onCancel={onCancel} />,
    );

    fireEvent(getByTestId("comment-input"), "blur");
    expect(onCancel).toHaveBeenCalled();
  });

  it("pre-fills TextInput when initialValue is provided", () => {
    const { getByTestId } = render(
      <CommentInput {...defaultProps} initialValue="Existing note" />,
    );

    expect(getByTestId("comment-input").props.value).toBe("Existing note");
  });

  it("clears input after successful save", () => {
    const onSave = jest.fn();
    const { getByTestId } = render(
      <CommentInput {...defaultProps} onSave={onSave} />,
    );

    fireEvent.changeText(getByTestId("comment-input"), "Test comment");
    fireEvent.press(getByTestId("comment-save"));

    expect(onSave).toHaveBeenCalledWith("Test comment");
    expect(getByTestId("comment-input").props.value).toBe("");
  });
});
