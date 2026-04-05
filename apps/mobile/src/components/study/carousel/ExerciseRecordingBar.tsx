// @MX:NOTE: [AUTO] Wraps RecordingBar and adds idle-state "Start Recording" button (SPEC-MOBILE-011).
// RecordingBar returns null when idle; this component adds the start button for that state.
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import RecordingBar from "../../shadowing/RecordingBar";
import { colors, font, radius } from "../../../theme";

interface ExerciseRecordingBarProps {
  recordingState: "idle" | "recording" | "playback";
  duration: number;
  isPlaying: boolean;
  playbackProgress: number;
  onStart?: () => void;
  onStop: () => void;
  onPlay: () => void;
  onPause: () => void;
  onReRecord: () => void;
  onConfirm: () => void;
}

export function ExerciseRecordingBar({
  recordingState,
  duration,
  isPlaying,
  playbackProgress,
  onStart,
  onStop,
  onPlay,
  onPause,
  onReRecord,
  onConfirm,
}: ExerciseRecordingBarProps) {
  if (recordingState === "idle") {
    return (
      <View style={styles.idleContainer}>
        <TouchableOpacity
          testID="start-recording-button"
          style={styles.startBtn}
          onPress={onStart}
          activeOpacity={0.7}
        >
          <Text style={styles.startText}>Start Recording</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <RecordingBar
      recordingState={recordingState}
      duration={duration}
      isPlaying={isPlaying}
      playbackProgress={playbackProgress}
      onStop={onStop}
      onPlay={onPlay}
      onPause={onPause}
      onReRecord={onReRecord}
      onConfirm={onConfirm}
    />
  );
}

const styles = StyleSheet.create({
  idleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "center",
  },
  startBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 36,
    paddingVertical: 16,
  },
  startText: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    letterSpacing: 1.5,
    color: colors.textInverse,
  },
});
