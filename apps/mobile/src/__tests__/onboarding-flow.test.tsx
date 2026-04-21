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

  it("completes onboarding and saves the learning profile with expression as the forced goal", async () => {
    // Speaking/pronunciation is feature-gated on main (see
    // feature/speaking-stability), so the goal step is skipped and
    // goal_mode is always "expression" at submit time.
    const { getByText, getByLabelText } = render(<OnboardingScreen />);

    fireEvent.press(getByText("일상 회화는 가능해요"));
    fireEvent.press(getByLabelText("학습 수준 다음 단계"));
    fireEvent.press(getByText("학교/업무"));
    fireEvent.press(getByText("셀럽 인터뷰"));
    fireEvent.press(getByLabelText("온보딩 완료하기"));

    await waitFor(() => {
      expect(mockUpdateLearningProfile).toHaveBeenCalledWith({
        level_band: "conversation",
        goal_mode: "expression",
        focus_tags: ["학교/업무", "셀럽 인터뷰"],
        preferred_speakers: [],
        preferred_situations: ["학교/업무"],
        preferred_video_categories: ["셀럽 인터뷰"],
        onboarding_completed_at: expect.any(String),
      });
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
  });

  it("coerces a legacy pronunciation profile into expression on edit", async () => {
    // Existing profiles with goal_mode = "pronunciation" from before the
    // feature gate must be migrated on the fly: the speaker selections
    // do not map onto expression's situation/topic model, so we reset
    // them and require the user to pick expression-specific details.
    mockParams = { edit: "1" };
    mockLearningProfile = {
      user_id: "user-1",
      level_band: "professional",
      goal_mode: "pronunciation",
      focus_tags: ["Jensen Huang"],
      preferred_speakers: ["Jensen Huang"],
      preferred_situations: [],
      preferred_video_categories: [],
      onboarding_completed_at: null,
    };

    const { getByText, getByLabelText } = render(<OnboardingScreen />);

    fireEvent.press(getByLabelText("학습 수준 다음 단계"));
    fireEvent.press(getByText("학교/업무"));
    fireEvent.press(getByText("셀럽 인터뷰"));
    fireEvent.press(getByText("저장하기"));

    await waitFor(() => {
      expect(mockUpdateLearningProfile).toHaveBeenCalledWith({
        level_band: "professional",
        goal_mode: "expression",
        focus_tags: ["학교/업무", "셀럽 인터뷰"],
        preferred_speakers: [],
        preferred_situations: ["학교/업무"],
        preferred_video_categories: ["셀럽 인터뷰"],
        onboarding_completed_at: expect.any(String),
      });
    });
  });

  it("returns to the details step when saving the profile fails", async () => {
    mockUpdateLearningProfile.mockRejectedValueOnce(new Error("save failed"));

    const { getByText, getByLabelText, findByText } = render(
      <OnboardingScreen />,
    );

    fireEvent.press(getByText("일상 회화는 가능해요"));
    fireEvent.press(getByLabelText("학습 수준 다음 단계"));
    fireEvent.press(getByText("학교/업무"));
    fireEvent.press(getByText("셀럽 인터뷰"));
    fireEvent.press(getByLabelText("온보딩 완료하기"));

    expect(
      await findByText("주로 어떤 상황에서 영어를 많이 쓰게 될까요?"),
    ).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
