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

// Page through the (mandatory) vocab test; the final "다음" submits the band and
// lands on the topics step.
async function passVocabTest(utils: ReturnType<typeof render>) {
  for (let i = 0; i < 10; i += 1) {
    if (utils.queryByText("어떤 주제에 관심 있으세요?")) break;
    const next = utils.queryByText("다음");
    if (!next) break;
    fireEvent.press(next);
    await act(async () => {});
  }
  await utils.findByText("어떤 주제에 관심 있으세요?");
}

// On the topics step: pick a topic → next → pick a format → save.
function selectInterestsAndComplete(utils: ReturnType<typeof render>) {
  fireEvent.press(utils.getByText("과학"));
  fireEvent.press(utils.getByText("다음"));
  fireEvent.press(utils.getByText("정보 / 설명형"));
  fireEvent.press(utils.getByText("저장하기"));
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

  it("measures the band via the vocab test then advances to topics", async () => {
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

  it("completes onboarding and saves v1.3 topic/format interests", async () => {
    const utils = render(<OnboardingScreen />);

    await passVocabTest(utils);
    selectInterestsAndComplete(utils);

    await waitFor(() => {
      expect(mockUpdateLearningProfile).toHaveBeenCalledWith({
        level_band: "conversation",
        goal_mode: "expression",
        focus_tags: ["topic:science", "format:nonfiction"],
        preferred_speakers: [],
        preferred_situations: [],
        preferred_source_types: [],
        preferred_genres: [],
        onboarding_completed_at: expect.any(String),
      });
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
  });

  it("saves from edit mode starting at the manual level picker", async () => {
    mockParams = { edit: "1" };
    mockLearningProfile = {
      user_id: "user-1",
      level_band: "professional",
      goal_mode: "expression",
      focus_tags: [],
      preferred_speakers: [],
      preferred_situations: [],
      preferred_source_types: [],
      preferred_genres: [],
      onboarding_completed_at: null,
    };

    const utils = render(<OnboardingScreen />);

    // Edit mode starts at the manual level picker (level is hydrated).
    fireEvent.press(utils.getByLabelText("학습 수준 다음 단계"));
    selectInterestsAndComplete(utils);

    await waitFor(() => {
      expect(mockUpdateLearningProfile).toHaveBeenCalledWith({
        level_band: "professional",
        goal_mode: "expression",
        focus_tags: ["topic:science", "format:nonfiction"],
        preferred_speakers: [],
        preferred_situations: [],
        preferred_source_types: [],
        preferred_genres: [],
        onboarding_completed_at: expect.any(String),
      });
    });
  });

  it("returns to the formats step when saving the profile fails", async () => {
    mockUpdateLearningProfile.mockRejectedValueOnce(new Error("save failed"));

    const utils = render(<OnboardingScreen />);

    await passVocabTest(utils);
    selectInterestsAndComplete(utils);

    expect(await utils.findByText("어떤 스타일을 좋아하세요?")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
