import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import PremiumSessionRoute from "../../app/premium/[sessionId]";
import { jonnyKimPremiumSessionFixture } from "../fixtures/premium-session";

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockFetchPremiumSessionById = jest.fn();
let mockSessionId: string | undefined = jonnyKimPremiumSessionFixture.id;

jest.mock("expo-router", () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    back: (...args: unknown[]) => mockBack(...args),
  },
  useLocalSearchParams: () => ({ sessionId: mockSessionId }),
}));

jest.mock("@/lib/premium-api", () => ({
  fetchPremiumSessionById: (...args: unknown[]) =>
    mockFetchPremiumSessionById(...args),
}));

jest.mock("@/components/premium/PremiumSessionScreen", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return function MockPremiumSessionScreen({
    session,
  }: {
    session: { title: string };
  }) {
    return React.createElement(Text, null, `session:${session.title}`);
  };
});

describe("PremiumSessionRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionId = jonnyKimPremiumSessionFixture.id;
  });

  it("renders the server-returned premium session", async () => {
    mockFetchPremiumSessionById.mockResolvedValueOnce({
      entitlement: {
        hasAccess: true,
        plan: "FREE",
        reason: "trial",
        trialEndsAt: null,
      },
      session: jonnyKimPremiumSessionFixture,
    });

    const { getByText } = render(<PremiumSessionRoute />);

    await waitFor(() => {
      expect(
        getByText(`session:${jonnyKimPremiumSessionFixture.title}`),
      ).toBeTruthy();
    });
    expect(mockFetchPremiumSessionById).toHaveBeenCalledWith(
      jonnyKimPremiumSessionFixture.id,
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("routes denied entitlement responses to the premium paywall", async () => {
    mockFetchPremiumSessionById.mockResolvedValueOnce({
      entitlement: {
        hasAccess: false,
        plan: "FREE",
        reason: "trial-expired",
        trialEndsAt: "2026-06-08T00:00:00.000Z",
      },
      session: null,
    });

    render(<PremiumSessionRoute />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/paywall");
    });
  });

  it("shows API errors instead of silently opening fixture content", async () => {
    mockFetchPremiumSessionById.mockRejectedValueOnce(
      new Error("Premium session is not today's curation"),
    );

    const { getByText } = render(<PremiumSessionRoute />);

    await waitFor(() => {
      expect(getByText("세션을 열 수 없어요")).toBeTruthy();
      expect(getByText("Premium session is not today's curation")).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not call the API when the route is missing a session id", async () => {
    mockSessionId = undefined;

    const { getByText } = render(<PremiumSessionRoute />);

    await waitFor(() => {
      expect(getByText("세션 ID가 없어요.")).toBeTruthy();
    });
    expect(mockFetchPremiumSessionById).not.toHaveBeenCalled();
  });
});
