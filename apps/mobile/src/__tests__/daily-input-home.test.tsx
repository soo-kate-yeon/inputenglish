import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import PremiumHomeScreen from "../../app/(tabs)/index";
import { jonnyKimPremiumSessionFixture } from "../fixtures/premium-session";
import {
  clearPremiumSessionProgress,
  markPremiumSessionCompleted,
  markPremiumSessionInProgress,
} from "@/lib/premium-session-progress";

const mockPush = jest.fn();
const mockFetchTodayPremiumSession = jest.fn();
const mockFetchTodayCiSession = jest
  .fn()
  .mockResolvedValue({ session: null, remainingQuestionCap: 100 });

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
  useFocusEffect: (callback: () => void) => {
    const React = require("react");
    React.useEffect(callback, [callback]);
  },
}));

jest.mock("@/lib/premium-api", () => ({
  fetchTodayPremiumSession: (...args: unknown[]) =>
    mockFetchTodayPremiumSession(...args),
  fetchTodayCiSession: (...args: unknown[]) => mockFetchTodayCiSession(...args),
}));

describe("PremiumHomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPremiumSessionProgress(jonnyKimPremiumSessionFixture.id);
  });

  it("renders today's premium curation and opens the session", async () => {
    mockFetchTodayPremiumSession.mockResolvedValueOnce({
      entitlement: {
        hasAccess: true,
        plan: "FREE",
        reason: "trial",
        trialEndsAt: null,
      },
      session: jonnyKimPremiumSessionFixture,
    });

    const { getByText, getByTestId } = render(<PremiumHomeScreen />);

    await waitFor(() => {
      expect(getByText("오늘 도착한 큐레이션")).toBeTruthy();
      expect(getByText(jonnyKimPremiumSessionFixture.title)).toBeTruthy();
    });

    fireEvent.press(getByTestId("premium-session-card"));

    expect(mockPush).toHaveBeenCalledWith(
      `/premium/${jonnyKimPremiumSessionFixture.id}`,
    );
  });

  it("routes to paywall when the premium API returns no session", async () => {
    mockFetchTodayPremiumSession.mockResolvedValueOnce({
      entitlement: {
        hasAccess: false,
        plan: "FREE",
        reason: "trial-expired",
        trialEndsAt: null,
      },
      session: null,
    });

    render(<PremiumHomeScreen />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/paywall");
    });
  });

  it("routes to paywall when server entitlement denies access even if a session is present", async () => {
    mockFetchTodayPremiumSession.mockResolvedValueOnce({
      entitlement: {
        hasAccess: false,
        plan: "FREE",
        reason: "trial-expired",
        trialEndsAt: "2026-06-08T00:00:00.000Z",
      },
      session: jonnyKimPremiumSessionFixture,
    });

    render(<PremiumHomeScreen />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/paywall");
    });
  });

  it("shows the pause state when today's session is in progress", async () => {
    markPremiumSessionInProgress(
      jonnyKimPremiumSessionFixture.id,
      "delivery-analysis",
    );
    mockFetchTodayPremiumSession.mockResolvedValueOnce({
      entitlement: {
        hasAccess: true,
        plan: "FREE",
        reason: "trial",
        trialEndsAt: null,
      },
      session: jonnyKimPremiumSessionFixture,
    });

    const { getByTestId, getByText } = render(<PremiumHomeScreen />);

    await waitFor(() => {
      expect(getByTestId("premium-home-pause-overlay")).toBeTruthy();
      expect(getByText("이어서 학습하기")).toBeTruthy();
      expect(getByText("마지막 위치: 분석하며 듣기")).toBeTruthy();
    });
  });

  it("shows the done state and can open review assets", async () => {
    markPremiumSessionCompleted(jonnyKimPremiumSessionFixture.id, 2);
    mockFetchTodayPremiumSession.mockResolvedValueOnce({
      entitlement: {
        hasAccess: true,
        plan: "PREMIUM",
        reason: "premium",
        trialEndsAt: null,
      },
      session: jonnyKimPremiumSessionFixture,
    });

    const { getByTestId, getByText } = render(<PremiumHomeScreen />);

    await waitFor(() => {
      expect(getByTestId("premium-home-done-overlay")).toBeTruthy();
      expect(getByText("이미 학습을 완료한 큐레이션이에요")).toBeTruthy();
      expect(getByText("2개 표현이 복습 자산에 저장됐어요.")).toBeTruthy();
    });

    fireEvent.press(getByText("복습하러가기"));
    expect(mockPush).toHaveBeenCalledWith("/(tabs)/archive");
  });
});
