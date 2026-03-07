// RED phase: Specification tests for useAudioRecorder hook
// Tests define expected behavior before implementation
import { renderHook, act } from "@testing-library/react-hooks";

// Mock expo-av before importing the hook
const mockRecording = {
  prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
  startAsync: jest.fn().mockResolvedValue(undefined),
  stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
  getURI: jest.fn().mockReturnValue("file:///mock/recording.m4a"),
  setOnRecordingStatusUpdate: jest.fn(),
};

const mockSound = {
  loadAsync: jest.fn().mockResolvedValue(undefined),
  playAsync: jest.fn().mockResolvedValue(undefined),
  pauseAsync: jest.fn().mockResolvedValue(undefined),
  stopAsync: jest.fn().mockResolvedValue(undefined),
  unloadAsync: jest.fn().mockResolvedValue(undefined),
  setOnPlaybackStatusUpdate: jest.fn(),
  getStatusAsync: jest
    .fn()
    .mockResolvedValue({ isLoaded: true, durationMillis: 5000 }),
};

jest.mock("expo-av", () => ({
  Audio: {
    Recording: jest.fn().mockImplementation(() => mockRecording),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({ sound: mockSound }),
    },
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    AndroidOutputFormat: { MPEG_4: 2 },
    AndroidAudioEncoder: { AAC: 3 },
    IOSAudioQuality: { HIGH: 0x7f },
    IOSOutputFormat: { MPEG4AAC: "aac" },
    RecordingOptionsPresets: {
      HIGH_QUALITY: {},
    },
  },
}));

import useAudioRecorder from "../useAudioRecorder";

describe("useAudioRecorder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("initial state", () => {
    it("should start in idle state", () => {
      const { result } = renderHook(() => useAudioRecorder());
      expect(result.current.recordingState).toBe("idle");
    });

    it("should have null audioUri initially", () => {
      const { result } = renderHook(() => useAudioRecorder());
      expect(result.current.audioUri).toBeNull();
    });

    it("should have 0 duration initially", () => {
      const { result } = renderHook(() => useAudioRecorder());
      expect(result.current.duration).toBe(0);
    });

    it("should not be playing initially", () => {
      const { result } = renderHook(() => useAudioRecorder());
      expect(result.current.isPlaying).toBe(false);
    });

    it("should have 0 playback progress initially", () => {
      const { result } = renderHook(() => useAudioRecorder());
      expect(result.current.playbackProgress).toBe(0);
    });
  });

  describe("startRecording", () => {
    it("should transition to recording state", async () => {
      const { result } = renderHook(() => useAudioRecorder());
      await act(async () => {
        await result.current.startRecording();
      });
      expect(result.current.recordingState).toBe("recording");
    });

    it("should not start recording when permission is denied", async () => {
      const { Audio } = require("expo-av");
      Audio.getPermissionsAsync.mockResolvedValue({ granted: false });
      Audio.requestPermissionsAsync.mockResolvedValue({ granted: false });

      const { result } = renderHook(() => useAudioRecorder());
      await act(async () => {
        await result.current.startRecording();
      });
      // Should remain idle when permission denied
      expect(result.current.recordingState).toBe("idle");
    });
  });

  describe("stopRecording", () => {
    it("should transition from recording to playback state", async () => {
      const { result } = renderHook(() => useAudioRecorder());
      await act(async () => {
        await result.current.startRecording();
      });
      await act(async () => {
        await result.current.stopRecording();
      });
      expect(result.current.recordingState).toBe("playback");
    });

    it("should set audioUri after stopping recording", async () => {
      const { result } = renderHook(() => useAudioRecorder());
      await act(async () => {
        await result.current.startRecording();
        await result.current.stopRecording();
      });
      expect(result.current.audioUri).toBe("file:///mock/recording.m4a");
    });
  });

  describe("resetRecording", () => {
    it("should reset to idle state from playback", async () => {
      const { result } = renderHook(() => useAudioRecorder());
      await act(async () => {
        await result.current.startRecording();
        await result.current.stopRecording();
      });
      act(() => {
        result.current.resetRecording();
      });
      expect(result.current.recordingState).toBe("idle");
    });

    it("should clear audioUri on reset", async () => {
      const { result } = renderHook(() => useAudioRecorder());
      await act(async () => {
        await result.current.startRecording();
        await result.current.stopRecording();
      });
      act(() => {
        result.current.resetRecording();
      });
      expect(result.current.audioUri).toBeNull();
    });

    it("should reset duration on reset", async () => {
      const { result } = renderHook(() => useAudioRecorder());
      await act(async () => {
        await result.current.startRecording();
      });
      // Advance timer to accumulate duration
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      await act(async () => {
        await result.current.stopRecording();
      });
      act(() => {
        result.current.resetRecording();
      });
      expect(result.current.duration).toBe(0);
    });
  });

  describe("permission handling", () => {
    it("should expose hasPermission status", () => {
      const { result } = renderHook(() => useAudioRecorder());
      // hasPermission can be null (checking) or boolean
      expect(
        result.current.hasPermission === null ||
          typeof result.current.hasPermission === "boolean",
      ).toBe(true);
    });

    it("should expose requestPermission function", () => {
      const { result } = renderHook(() => useAudioRecorder());
      expect(typeof result.current.requestPermission).toBe("function");
    });
  });
});
