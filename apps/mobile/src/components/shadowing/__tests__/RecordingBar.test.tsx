// RED phase: Specification tests for RecordingBar component
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import RecordingBar from "../RecordingBar";

const baseProps = {
  recordingState: "idle" as const,
  duration: 0,
  isPlaying: false,
  playbackProgress: 0,
  onStop: jest.fn(),
  onPlay: jest.fn(),
  onPause: jest.fn(),
  onReRecord: jest.fn(),
  onConfirm: jest.fn(),
};

describe("RecordingBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("idle state", () => {
    it("should return null when recordingState is idle", () => {
      const { toJSON } = render(
        <RecordingBar {...baseProps} recordingState="idle" />,
      );
      expect(toJSON()).toBeNull();
    });
  });

  describe("recording state", () => {
    const recordingProps = {
      ...baseProps,
      recordingState: "recording" as const,
      duration: 5,
    };

    it("should render stop button in recording state", () => {
      const { getByTestId } = render(<RecordingBar {...recordingProps} />);
      expect(getByTestId("stop-button")).toBeTruthy();
    });

    it("should display formatted duration in MM:SS format", () => {
      const { getByText } = render(
        <RecordingBar {...recordingProps} duration={65} />,
      );
      expect(getByText("01:05")).toBeTruthy();
    });

    it("should display 00:00 for zero duration", () => {
      const { getByText } = render(
        <RecordingBar {...recordingProps} duration={0} />,
      );
      expect(getByText("00:00")).toBeTruthy();
    });

    it("should call onStop when stop button is pressed", () => {
      const onStop = jest.fn();
      const { getByTestId } = render(
        <RecordingBar {...recordingProps} onStop={onStop} />,
      );
      fireEvent.press(getByTestId("stop-button"));
      expect(onStop).toHaveBeenCalledTimes(1);
    });
  });

  describe("playback state", () => {
    const playbackProps = {
      ...baseProps,
      recordingState: "playback" as const,
      duration: 10,
      isPlaying: false,
      playbackProgress: 0.5,
    };

    it("should render play button when not playing", () => {
      const { getByTestId } = render(
        <RecordingBar {...playbackProps} isPlaying={false} />,
      );
      expect(getByTestId("play-button")).toBeTruthy();
    });

    it("should render pause button when playing", () => {
      const { getByTestId } = render(
        <RecordingBar {...playbackProps} isPlaying={true} />,
      );
      expect(getByTestId("pause-button")).toBeTruthy();
    });

    it("should call onPlay when play button is pressed", () => {
      const onPlay = jest.fn();
      const { getByTestId } = render(
        <RecordingBar {...playbackProps} isPlaying={false} onPlay={onPlay} />,
      );
      fireEvent.press(getByTestId("play-button"));
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    it("should call onPause when pause button is pressed", () => {
      const onPause = jest.fn();
      const { getByTestId } = render(
        <RecordingBar {...playbackProps} isPlaying={true} onPause={onPause} />,
      );
      fireEvent.press(getByTestId("pause-button"));
      expect(onPause).toHaveBeenCalledTimes(1);
    });

    it("should render re-record button", () => {
      const { getByTestId } = render(<RecordingBar {...playbackProps} />);
      expect(getByTestId("rerecord-button")).toBeTruthy();
    });

    it("should call onReRecord when re-record button is pressed", () => {
      const onReRecord = jest.fn();
      const { getByTestId } = render(
        <RecordingBar {...playbackProps} onReRecord={onReRecord} />,
      );
      fireEvent.press(getByTestId("rerecord-button"));
      expect(onReRecord).toHaveBeenCalledTimes(1);
    });

    it("should render confirm button", () => {
      const { getByTestId } = render(<RecordingBar {...playbackProps} />);
      expect(getByTestId("confirm-button")).toBeTruthy();
    });

    it("should call onConfirm when confirm button is pressed", () => {
      const onConfirm = jest.fn();
      const { getByTestId } = render(
        <RecordingBar {...playbackProps} onConfirm={onConfirm} />,
      );
      fireEvent.press(getByTestId("confirm-button"));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("should display progress bar", () => {
      const { getByTestId } = render(
        <RecordingBar {...playbackProps} playbackProgress={0.5} />,
      );
      expect(getByTestId("progress-bar")).toBeTruthy();
    });
  });
});
