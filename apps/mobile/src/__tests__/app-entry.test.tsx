import React from "react";
import { render } from "@testing-library/react-native";

let mockAuthState: any = {
  user: null,
  learningProfile: null,
  isInitialized: true,
  isProfileLoading: false,
};

jest.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require("react-native");
    return <Text>{href}</Text>;
  },
}));

jest.mock("../../src/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => mockAuthState),
}));

describe("AppEntryScreen", () => {
  const AppEntryScreen = require("../../app/index").default;

  beforeEach(() => {
    mockAuthState = {
      user: null,
      learningProfile: null,
      isInitialized: true,
      isProfileLoading: false,
    };
  });

  it("routes signed-out users to intro", () => {
    const { getByText } = render(<AppEntryScreen />);
    expect(getByText("/intro")).toBeTruthy();
  });

  it("routes signed-in users without onboarding completion to onboarding", () => {
    mockAuthState = {
      ...mockAuthState,
      user: { id: "user-1" },
      learningProfile: { onboarding_completed_at: null },
    };

    const { getByText } = render(<AppEntryScreen />);
    expect(getByText("/onboarding")).toBeTruthy();
  });

  it("routes signed-in users with completed onboarding to tabs", () => {
    mockAuthState = {
      ...mockAuthState,
      user: { id: "user-1" },
      learningProfile: { onboarding_completed_at: "2026-04-19T00:00:00.000Z" },
    };

    const { getByText } = render(<AppEntryScreen />);
    expect(getByText("/(tabs)")).toBeTruthy();
  });
});
