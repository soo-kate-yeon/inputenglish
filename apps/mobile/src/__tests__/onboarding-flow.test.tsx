import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

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

// Page through the (mandatory) vocab test and submit, landing on the details
// step. The button is always "다음"; the final press submits and advances, so we
// stop once the details title appears (and flush the async submit between taps).
async function passVocabTest(utils: ReturnType<typeof render>) {
  for (let i = 0; i < 10; i += 1) {
    if (utils.queryByText("주로 어떤 상황에서 영어를 많이 쓰게 될까요?")) break;
    const next = utils.queryByText("다음");
    if (!next) break;
    fireEvent.press(next);
    await act(async () => {});
  }
  await utils.findByText("주로 어떤 상황에서 영어를 많이 쓰게 될까요?");
}

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
    const utils = render(<OnboardingScreen />);

    await passVocabTest(utils);

    expect(mockSubmitVocab).toHaveBeenCalled();
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
    // goal_mode is always "expression" at submit time. The band comes from the
    // vocab test (mocked → "conversation").
    const utils = render(<OnboardingScreen />);
    const { getByText, getByLabelText } = utils;

    await passVocabTest(utils);
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

    const utils = render(<OnboardingScreen />);
    const { getByText, getByLabelText, findByText } = utils;

    await passVocabTest(utils);
    fireEvent.press(getByText("학교/업무"));
    fireEvent.press(getByText("업무"));
    fireEvent.press(getByLabelText("온보딩 완료하기"));

    expect(
      await findByText("주로 어떤 상황에서 영어를 많이 쓰게 될까요?"),
    ).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
