// TDD: Specification tests for UndoToast
// SPEC-MOBILE-005 - REQ-E-004, REQ-N-001
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import UndoToast from "../UndoToast";

describe("UndoToast", () => {
  it("should not render when visible is false", () => {
    const { queryByText } = render(
      <UndoToast
        visible={false}
        message="삭제되었습니다."
        onUndo={jest.fn()}
      />,
    );
    expect(queryByText("삭제되었습니다.")).toBeNull();
  });

  it("should render message when visible is true", () => {
    const { getByText } = render(
      <UndoToast visible={true} message="삭제되었습니다." onUndo={jest.fn()} />,
    );
    expect(getByText("삭제되었습니다.")).toBeTruthy();
  });

  it("should call onUndo when undo button is pressed", () => {
    const onUndo = jest.fn();
    const { getByText } = render(
      <UndoToast visible={true} message="삭제되었습니다." onUndo={onUndo} />,
    );
    fireEvent.press(getByText("실행 취소"));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
