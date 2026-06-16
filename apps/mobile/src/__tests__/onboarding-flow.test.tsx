import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockUpdateLearningProfile = jest.fn();
const mockTrackEvent = jest.fn();
const mockSubmitVocab = jest.fn();
let mockParams: { edit?: string } = {};
let mockLearningProfile: any = null;

jest.mock("expo-router", () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    back: (...args: unknown[]) => mockBack(...args),
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

// premium-api pulls in @/lib/supabase (throws at load without env). Mock it so
// onboarding can import submitVocabAssessment in tests.
jest.mock("../../src/lib/premium-api", () => ({
  submitVocabAssessment: (...args: unknown[]) => mockSubmitVocab(...args),
}));

describe("OnboardingScreen", () => {
  const OnboardingScreen = require("../../app/onboarding").default;

  beforeEach(() => {
    mockReplace.mockClear();
    mockUpdateLearningProfile.mockReset();
    mockUpdateLearningProfile.mockResolvedValue({});
    mockTrackEvent.mockClear();
    mockBack.mockClear();
    mockSubmitVocab.mockReset();
    mockSubmitVocab.mockResolvedValue({
      estimatedBand: "conversation",
      estimatedLevel: "B1",
      seedCount: 12,
    });
    mockParams = {};
    mockLearningProfile = null;
  });

  it("measures the band via the vocab test then advances to details", async () => {
    const { getByText, queryByText } = render(<OnboardingScreen />);

    // Vocab test is the first step. Page through to the end and submit.
    for (let i = 0; i < 12; i += 1) {
      const next = queryByText("다음");
      if (!next) break;
      fireEvent.press(next);
    }
    fireEvent.press(getByText("결과 확인"));

    await waitFor(() => {
      expect(mockSubmitVocab).toHaveBeenCalled();
      // Advanced to the details step after the server returns the band.
      expect(
        getByText("주로 어떤 상황에서 영어를 많이 쓰게 될까요?"),
      ).toBeTruthy();
    });
  });

  it("vocab back goes one page within the test, and exits from the first page", () => {
    const { getByText, getByLabelText } = render(<OnboardingScreen />);

    // First page: back exits the test (router.back).
    fireEvent.press(getByLabelText("이전"));
    expect(mockBack).toHaveBeenCalledTimes(1);

    mockBack.mockClear();

    // Advance a page, then back stays inside the test (no router.back).
    fireEvent.press(getByText("다음"));
    fireEvent.press(getByLabelText("이전"));
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("completes onboarding and saves the learning profile with expression as the forced goal", async () => {
    // Speaking/pronunciation is feature-gated on main (see
    // feature/speaking-stability), so the goal step is skipped and
    // goal_mode is always "expression" at submit time.
    const { getByText, getByLabelText } = render(<OnboardingScreen />);

    // Skip the vocab test to reach the manual level picker (fallback path).
    fireEvent.press(getByText("건너뛰고 직접 선택할게요"));
    fireEvent.press(getByText("일상 회화는 가능해요"));
    fireEvent.press(getByLabelText("학습 수준 다음 단계"));
    fireEvent.press(getByText("학교/업무"));
    fireEvent.press(getByText("업무"));
    fireEvent.press(getByLabelText("온보딩 완료하기"));

    await waitFor(() => {
      expect(mockUpdateLearningProfile).toHaveBeenCalledWith({
        level_band: "conversation",
        goal_mode: "expression",
        focus_tags: ["school-work", "business"],
        preferred_speakers: [],
        preferred_situations: ["school-work"],
        preferred_source_types: [
          "public-speech",
          "interview",
          "podcast",
          "keynote",
        ],
        preferred_genres: ["business"],
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
      preferred_source_types: [],
      preferred_genres: [],
      onboarding_completed_at: null,
    };

    const { getByText, getByLabelText } = render(<OnboardingScreen />);

    fireEvent.press(getByLabelText("학습 수준 다음 단계"));
    fireEvent.press(getByText("학교/업무"));
    fireEvent.press(getByText("업무"));
    fireEvent.press(getByText("저장하기"));

    await waitFor(() => {
      expect(mockUpdateLearningProfile).toHaveBeenCalledWith({
        level_band: "professional",
        goal_mode: "expression",
        focus_tags: ["school-work", "business"],
        preferred_speakers: [],
        preferred_situations: ["school-work"],
        preferred_source_types: [
          "public-speech",
          "interview",
          "podcast",
          "keynote",
        ],
        preferred_genres: ["business"],
        onboarding_completed_at: expect.any(String),
      });
    });
  });

  it("returns to the details step when saving the profile fails", async () => {
    mockUpdateLearningProfile.mockRejectedValueOnce(new Error("save failed"));

    const { getByText, getByLabelText, findByText } = render(
      <OnboardingScreen />,
    );

    fireEvent.press(getByText("건너뛰고 직접 선택할게요"));
    fireEvent.press(getByText("일상 회화는 가능해요"));
    fireEvent.press(getByLabelText("학습 수준 다음 단계"));
    fireEvent.press(getByText("학교/업무"));
    fireEvent.press(getByText("업무"));
    fireEvent.press(getByLabelText("온보딩 완료하기"));

    expect(
      await findByText("주로 어떤 상황에서 영어를 많이 쓰게 될까요?"),
    ).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
