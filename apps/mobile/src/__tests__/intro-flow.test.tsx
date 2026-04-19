import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { INTRO_SCENES } from "../../src/lib/onboarding-intro";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockTrackEvent = jest.fn();
let mockParams: { preview?: string; scene?: string } = {};
let mockAuthState: any = {
  user: null,
  learningProfile: null,
  isInitialized: true,
  isProfileLoading: false,
};

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock("../../src/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => mockAuthState),
}));

jest.mock("../../src/lib/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock("../../src/components/auth/OAuthButtons", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  return {
    OAuthButtons: () =>
      React.createElement(
        View,
        { testID: "oauth-buttons" },
        React.createElement(Text, null, "OAuth Buttons"),
      ),
  };
});

jest.mock("../../src/components/auth/LoginForm", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  return {
    LoginForm: () =>
      React.createElement(
        View,
        { testID: "login-form" },
        React.createElement(Text, null, "Login Form"),
      ),
  };
});

jest.mock("../../src/components/auth/SignupForm", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  return {
    SignupForm: () =>
      React.createElement(
        View,
        { testID: "signup-form" },
        React.createElement(Text, null, "Signup Form"),
      ),
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe("IntroScreen", () => {
  const IntroScreen = require("../../app/intro").default;

  beforeEach(() => {
    jest.useFakeTimers();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockTrackEvent.mockClear();
    mockParams = {};
    mockAuthState = {
      user: null,
      learningProfile: null,
      isInitialized: true,
      isProfileLoading: false,
    };
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("tracks intro impression and keeps login CTA hidden on the first scene", () => {
    const { queryByTestId } = render(<IntroScreen />);

    expect(
      mockTrackEvent.mock.calls.some(([event]) => event === "intro_impression"),
    ).toBe(true);
    expect(queryByTestId("oauth-buttons")).toBeNull();
    expect(queryByTestId("login-form")).toBeNull();
  });

  it("shows login by default and opens signup sheet on the final scene", async () => {
    mockParams = { scene: String(INTRO_SCENES.length) };
    const { getByTestId, getByText, queryByTestId } = render(<IntroScreen />);

    await act(async () => {
      jest.advanceTimersByTime(4000);
    });

    await waitFor(() => {
      expect(getByTestId("oauth-buttons")).toBeTruthy();
      expect(getByTestId("login-form")).toBeTruthy();
    });

    expect(queryByTestId("signup-form")).toBeNull();

    fireEvent.press(getByText("회원가입"));

    expect(getByTestId("signup-form")).toBeTruthy();
    expect(
      mockTrackEvent.mock.calls.some(
        ([event]) => event === "intro_signup_open_click",
      ),
    ).toBe(true);
  });
});
