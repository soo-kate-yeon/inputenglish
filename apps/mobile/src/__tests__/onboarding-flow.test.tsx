import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockReplace = jest.fn();
const mockUpdateLearningProfile = jest.fn();
const mockTrackEvent = jest.fn();
let mockParams: { edit?: string } = {};
let mockLearningProfile: any = null;

jest.mock("expo-router", () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: jest.fn(() => mockParams),
}));

jest.mock("../../src/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => ({
    user: { id: "user-1" },
    learningProfile: mockLearningProfile,
    isProfileLoading: false,
    updateLearningProfile: mockUpdateLearningProfile,
  })),
}));

jest.mock("../../src/lib/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

describe("OnboardingScreen", () => {
  const OnboardingScreen = require("../../app/onboarding").default;

  beforeEach(() => {
    mockReplace.mockClear();
    mockUpdateLearningProfile.mockReset();
    mockUpdateLearningProfile.mockResolvedValue({});
    mockTrackEvent.mockClear();
    mockParams = {};
    mockLearningProfile = null;
  });

  it("completes onboarding and saves the learning profile", async () => {
    const { getByText, getByLabelText } = render(<OnboardingScreen />);

    fireEvent.press(getByText("일상 회화 가능"));
    fireEvent.press(getByLabelText("학습 수준 다음 단계"));
    fireEvent.press(getByText("표현 훔치기"));
    fireEvent.press(getByText("회의/업데이트"));
    fireEvent.press(getByLabelText("온보딩 완료하기"));

    await waitFor(() => {
      expect(mockUpdateLearningProfile).toHaveBeenCalledWith({
        level_band: "conversation",
        goal_mode: "expression",
        focus_tags: ["회의/업데이트"],
        preferred_speakers: [],
        preferred_situations: ["회의/업데이트"],
        onboarding_completed_at: expect.any(String),
      });
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
  });

  it("supports edit mode with existing selections", async () => {
    mockParams = { edit: "1" };
    mockLearningProfile = {
      user_id: "user-1",
      level_band: "professional",
      goal_mode: "pronunciation",
      focus_tags: ["또렷한 발표 스타일"],
      preferred_speakers: ["또렷한 발표 스타일"],
      preferred_situations: [],
      onboarding_completed_at: null,
    };

    const { getByText, getByLabelText } = render(<OnboardingScreen />);

    fireEvent.press(getByLabelText("학습 수준 다음 단계"));
    fireEvent.press(getByText("저장하기"));

    await waitFor(() => {
      expect(mockUpdateLearningProfile).toHaveBeenCalledWith({
        level_band: "professional",
        goal_mode: "pronunciation",
        focus_tags: ["또렷한 발표 스타일"],
        preferred_speakers: ["또렷한 발표 스타일"],
        preferred_situations: [],
        onboarding_completed_at: expect.any(String),
      });
    });
  });
});
