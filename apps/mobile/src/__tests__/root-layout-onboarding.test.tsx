import React from "react";
import { render, waitFor } from "@testing-library/react-native";

const mockReplace = jest.fn();
let mockSegments: string[] = ["(auth)"];
let mockSearchParams: { edit?: string } = {};
let mockAuthState: any = {
  isInitialized: true,
  isProfileLoading: false,
  learningProfile: null,
  user: { id: "user-1" },
};

jest.mock("expo-router", () => {
  const React = require("react");
  const MockStack = ({ children }: { children: React.ReactNode }) => children;
  MockStack.Screen = () => null;

  return {
    Stack: MockStack,
    useRouter: () => ({
      replace: (...args: unknown[]) => mockReplace(...args),
    }),
    useSegments: () => mockSegments,
    useGlobalSearchParams: () => mockSearchParams,
  };
});

jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock("expo-linking", () => ({
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock("expo-notifications", () => ({
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
}));
jest.mock("../../src/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: jest.fn(() => mockAuthState),
}));
jest.mock("../../src/lib/supabase", () => ({
  supabase: { auth: { exchangeCodeForSession: jest.fn() } },
}));
jest.mock("../../src/lib/revenue-cat", () => ({
  configureRevenueCat: jest.fn(),
  logInRevenueCat: jest.fn(),
}));
jest.mock("../../src/components/OfflineBanner", () => ({
  OfflineBanner: () => null,
}));

describe("RootLayoutNav onboarding redirects", () => {
  const { RootLayoutNav } = require("../../app/_layout");

  beforeEach(() => {
    mockReplace.mockClear();
    mockSegments = ["(auth)"];
    mockSearchParams = {};
    mockAuthState = {
      isInitialized: true,
      isProfileLoading: false,
      learningProfile: null,
      user: { id: "user-1" },
    };
  });

  it("sends signed-in users without onboarding completion to onboarding", async () => {
    render(<RootLayoutNav />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/onboarding");
    });
  });

  it("sends signed-in users with completed onboarding to tabs", async () => {
    mockAuthState = {
      ...mockAuthState,
      learningProfile: {
        onboarding_completed_at: "2026-04-18T10:00:00.000Z",
      },
    };

    render(<RootLayoutNav />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
  });

  it("allows onboarding edit mode without forcing tabs redirect", async () => {
    mockSegments = ["onboarding"];
    mockSearchParams = { edit: "1" };
    mockAuthState = {
      ...mockAuthState,
      learningProfile: {
        onboarding_completed_at: "2026-04-18T10:00:00.000Z",
      },
    };

    render(<RootLayoutNav />);

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalledWith("/(tabs)");
    });
  });
});
