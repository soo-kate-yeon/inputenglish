import React from "react";
import { render } from "@testing-library/react-native";
import FloatingTabBar from "../components/common/FloatingTabBar";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("../lib/analytics", () => ({
  trackEvent: jest.fn(),
}));

const props = {
  state: {
    stale: false,
    type: "tab",
    key: "tab-state",
    index: 0,
    routeNames: ["index", "archive", "profile"],
    routes: [
      { key: "index-key", name: "index" },
      { key: "archive-key", name: "archive" },
      { key: "profile-key", name: "profile" },
    ],
    history: [],
  },
  descriptors: {},
  navigation: {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
  },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
} as never;

describe("FloatingTabBar", () => {
  it("labels the premium home tab as today", () => {
    const { getByText, queryByText } = render(<FloatingTabBar {...props} />);

    expect(getByText("오늘")).toBeTruthy();
    expect(getByText("보관함")).toBeTruthy();
    expect(getByText("프로필")).toBeTruthy();
    expect(queryByText("쇼츠")).toBeNull();
    expect(queryByText("탐색")).toBeNull();
  });
});
