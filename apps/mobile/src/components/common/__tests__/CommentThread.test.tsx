import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import type { CardComment } from "@inputenglish/shared";

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  const MockIcon = (props: { name: string; testID?: string }) => (
    <Text testID={props.testID}>{props.name}</Text>
  );
  return { Ionicons: MockIcon };
});

const mockComments: CardComment[] = [
  {
    id: "c1",
    targetType: "saved_sentence",
    targetId: "s1",
    body: "First comment",
    createdAt: "2026-04-01T09:00:00.000Z",
    updatedAt: "2026-04-01T09:00:00.000Z",
  },
  {
    id: "c2",
    targetType: "saved_sentence",
    targetId: "s1",
    body: "Second comment",
    createdAt: "2026-04-02T10:00:00.000Z",
    updatedAt: "2026-04-02T10:00:00.000Z",
  },
];

describe("CommentThread", () => {
  const CommentThread = require("../CommentThread").default;

  const defaultProps = {
    comments: [] as CardComment[],
    onAdd: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders add trigger when no comments exist", () => {
    const { getByText } = render(<CommentThread {...defaultProps} />);
    expect(getByText("메모 추가...")).toBeTruthy();
  });

  it("renders all comments in order", () => {
    const { getByText } = render(
      <CommentThread {...defaultProps} comments={mockComments} />,
    );
    expect(getByText("First comment")).toBeTruthy();
    expect(getByText("Second comment")).toBeTruthy();
  });

  it("opens CommentInput when add trigger is tapped", () => {
    const { getByText, getByTestId } = render(
      <CommentThread {...defaultProps} />,
    );

    fireEvent.press(getByText("메모 추가..."));
    expect(getByTestId("comment-input")).toBeTruthy();
  });

  it("calls onAdd when a new comment is saved", () => {
    const onAdd = jest.fn();
    const { getByText, getByTestId } = render(
      <CommentThread {...defaultProps} onAdd={onAdd} />,
    );

    fireEvent.press(getByText("메모 추가..."));
    fireEvent.changeText(getByTestId("comment-input"), "New note");
    fireEvent.press(getByTestId("comment-save"));

    expect(onAdd).toHaveBeenCalledWith("New note");
  });

  it("enters edit mode when pencil icon is tapped", () => {
    const { getByTestId } = render(
      <CommentThread {...defaultProps} comments={mockComments} />,
    );

    fireEvent.press(getByTestId("comment-edit-c1"));
    // Should show input with existing text
    expect(getByTestId("comment-input").props.value).toBe("First comment");
  });

  it("calls onEdit when edit is saved", () => {
    const onEdit = jest.fn();
    const { getByTestId } = render(
      <CommentThread
        {...defaultProps}
        comments={mockComments}
        onEdit={onEdit}
      />,
    );

    fireEvent.press(getByTestId("comment-edit-c1"));
    fireEvent.changeText(getByTestId("comment-input"), "Edited comment");
    fireEvent.press(getByTestId("comment-save"));

    expect(onEdit).toHaveBeenCalledWith("c1", "Edited comment");
  });

  it("exits edit mode when input loses focus", () => {
    const { getByTestId, getByText } = render(
      <CommentThread {...defaultProps} comments={mockComments} />,
    );

    fireEvent.press(getByTestId("comment-edit-c1"));
    fireEvent(getByTestId("comment-input"), "blur");

    // Should show the original comment text again
    expect(getByText("First comment")).toBeTruthy();
  });

  it("calls onDelete when trash icon is tapped", () => {
    const onDelete = jest.fn();
    const { getByTestId } = render(
      <CommentThread
        {...defaultProps}
        comments={mockComments}
        onDelete={onDelete}
      />,
    );

    fireEvent.press(getByTestId("comment-delete-c2"));
    expect(onDelete).toHaveBeenCalledWith("c2");
  });

  it("still shows add trigger when comments exist", () => {
    const { getByText } = render(
      <CommentThread {...defaultProps} comments={mockComments} />,
    );
    expect(getByText("메모 추가...")).toBeTruthy();
  });
});
