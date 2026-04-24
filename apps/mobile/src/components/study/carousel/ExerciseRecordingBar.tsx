// @MX:NOTE: [AUTO] FAB-style recording overlay for transformation exercises (SPEC-MOBILE-011).
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius, spacing } from "../../../theme";

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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
}: ExerciseRecordingBarProps) {
  if (recordingState === "idle") {
    return (
      <View style={styles.containerRight}>
        <Pressable
          testID="start-recording-button"
          style={({ pressed }) => [
            styles.fabPrimary,
            pressed && { opacity: 0.85 },
          ]}
          onPress={onStart}
          disabled={!onStart}
        >
          <Ionicons name="mic" size={22} color={colors.textInverse} />
        </Pressable>
      </View>
    );
  }

  if (recordingState === "recording") {
    return (
      <View style={styles.containerRight}>
        <Text style={styles.timer}>{fmt(duration)}</Text>
        <Pressable
          testID="stop-button"
          style={({ pressed }) => [
            styles.fabPrimary,
            pressed && { opacity: 0.85 },
          ]}
          onPress={onStop}
        >
          <Ionicons name="stop" size={20} color={colors.textInverse} />
        </Pressable>
      </View>
    );
  }

  // Playback — full-width row: [progress bar] [redo] [play/pause]
  return (
    <View style={styles.containerWide}>
      <View style={styles.progressWrapper}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width:
                  `${(playbackProgress * 100).toFixed(1)}%` as `${number}%`,
              },
            ]}
          />
        </View>
      </View>

      <Pressable
        testID="rerecord-button"
        style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
        onPress={onReRecord}
      >
        <Ionicons name="refresh" size={18} color={colors.text} />
      </Pressable>

      <Pressable
        testID={isPlaying ? "pause-button" : "play-button"}
        style={({ pressed }) => [
          styles.fabPrimary,
          pressed && { opacity: 0.85 },
        ]}
        onPress={isPlaying ? onPause : onPlay}
      >
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={20}
          color={colors.textInverse}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  containerRight: {
    position: "absolute",
    bottom: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  timer: {
    fontSize: 13,
    fontWeight: font.weight.bold,
    color: colors.text,
    letterSpacing: 1,
    minWidth: 40,
    textAlign: "right",
  },
  containerWide: {
    position: "absolute",
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  progressWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.text,
    borderRadius: 2,
  },
  fabPrimary: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.bgInverse,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
});
