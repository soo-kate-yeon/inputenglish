import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import HomeScreen from "../../app/(tabs)/index";
import { ciSessionFixture } from "../fixtures/ci-session";

const mockPush = jest.fn();
const mockFetchTodayPremiumSession = jest.fn();
const mockFetchTodayCiSession = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

jest.mock("@/lib/premium-api", () => ({
  fetchTodayPremiumSession: (...args: unknown[]) =>
    mockFetchTodayPremiumSession(...args),
  fetchTodayCiSession: (...args: unknown[]) => mockFetchTodayCiSession(...args),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const grantedEntitlement = {
  entitlement: {
    hasAccess: true,
    plan: "FREE" as const,
    reason: "trial" as const,
    trialEndsAt: null,
  },
  session: null,
};

describe("HomeScreen (v1.3 CI session surface)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders today's CI session and opens the session player", async () => {
    mockFetchTodayPremiumSession.mockResolvedValueOnce(grantedEntitlement);
    mockFetchTodayCiSession.mockResolvedValueOnce({
      session: ciSessionFixture,
      remainingQuestionCap: 100,
    });

    const { getByText, getByTestId } = render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText("오늘 도착한 세션")).toBeTruthy();
      expect(getByText(ciSessionFixture.readingPiece.topic)).toBeTruthy();
    });

    fireEvent.press(getByTestId("ci-session-card"));
    expect(mockPush).toHaveBeenCalledWith("/premium");
  });

  it("routes to paywall when server entitlement denies access", async () => {
    mockFetchTodayPremiumSession.mockResolvedValueOnce({
      entitlement: {
        hasAccess: false,
        plan: "FREE",
        reason: "trial-expired",
        trialEndsAt: null,
      },
      session: null,
    });
    mockFetchTodayCiSession.mockResolvedValueOnce({
      session: null,
      remainingQuestionCap: 100,
    });

    render(<HomeScreen />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/paywall");
    });
  });

  it("shows the empty state when no CI session is ready", async () => {
    mockFetchTodayPremiumSession.mockResolvedValueOnce(grantedEntitlement);
    mockFetchTodayCiSession.mockResolvedValueOnce({
      session: null,
      remainingQuestionCap: 100,
    });

    const { getByText } = render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText("오늘 세션을 준비 중이에요")).toBeTruthy();
    });
  });
});
