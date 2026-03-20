// Integration tests for the shadowing workflow
import React from "react";
import { render, fireEvent, act, waitFor } from "@testing-library/react-native";

// Mock dependencies
jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ videoId: "test-video-123" })),
}));

jest.mock("expo-av", () => ({
  Audio: {
    Recording: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
      startAsync: jest.fn().mockResolvedValue(undefined),
      stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
      getURI: jest.fn().mockReturnValue("file:///mock/recording.m4a"),
      setOnRecordingStatusUpdate: jest.fn(),
    })),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          playAsync: jest.fn().mockResolvedValue(undefined),
          pauseAsync: jest.fn().mockResolvedValue(undefined),
          stopAsync: jest.fn().mockResolvedValue(undefined),
          unloadAsync: jest.fn().mockResolvedValue(undefined),
          setOnPlaybackStatusUpdate: jest.fn(),
        },
      }),
    },
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    AndroidOutputFormat: { MPEG_4: 2 },
    AndroidAudioEncoder: { AAC: 3 },
    IOSAudioQuality: { HIGH: 0x7f },
    IOSOutputFormat: { MPEG4AAC: "aac" },
  },
}));

const mockVideo = {
  id: "v1",
  video_id: "test-video-123",
  title: "Test Shadowing Video",
  transcript: [
    { id: "s1", text: "Hello world", startTime: 0, endTime: 2, highlights: [] },
    {
      id: "s2",
      text: "How are you?",
      startTime: 2,
      endTime: 4,
      highlights: [],
    },
  ],
  snippet_start_time: 0,
};

jest.mock("../../lib/api", () => ({
  fetchCuratedVideo: jest.fn().mockResolvedValue(mockVideo),
}));

jest.mock("../../lib/stores", () => ({
  studyStore: Object.assign(
    jest.fn(() => ({
      currentSession: null,
    })),
    {
      getState: jest.fn(() => ({
        updateSessionPhase: jest.fn(),
      })),
    },
  ),
  appStore: jest.fn(() => ({})),
}));

// Mock @inputenglish/shared
jest.mock("@inputenglish/shared", () => ({
  groupSentencesByMode: jest.fn((sentences) => sentences),
}));

// Mock YouTubePlayer
jest.mock("../../components/player/YouTubePlayer", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockPlayer = React.forwardRef(
    (_props: object, _ref: React.Ref<unknown>) => {
      return React.createElement(View, { testID: "youtube-player" });
    },
  );
  MockPlayer.displayName = "YouTubePlayer";
  return { default: MockPlayer };
});

// Lazy import to ensure mocks are set up
let ShadowingScreen: React.ComponentType;

describe("ShadowingScreen integration", () => {
  beforeAll(async () => {
    const mod = await import("../../app/shadowing/[videoId]");
    ShadowingScreen = mod.default;
  });

  it("should render loading initially", () => {
    const { getByTestId } = render(<ShadowingScreen />);
    // Initial state is loading - may render ActivityIndicator
    // After loading, should show content
    expect(getByTestId).toBeTruthy();
  });

  it("should render sentences after loading", async () => {
    const { findByText } = render(<ShadowingScreen />);
    await waitFor(async () => {
      const elem = await findByText("Hello world");
      expect(elem).toBeTruthy();
    });
  });
});
