// @MX:NOTE: [AUTO] Fixed bottom recording bar — editorial-tech theme, pill buttons.
// @MX:SPEC: SPEC-MOBILE-004 - REQ-S-001, REQ-S-002, REQ-S-003, REQ-E-002, REQ-E-003, REQ-E-004
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, font } from "../../theme";

interface RecordingBarProps {
  recordingState: "idle" | "recording" | "playback";
  duration: number;
  isPlaying: boolean;
  playbackProgress: number;
  onStop: () => void;
  onPlay: () => void;
  onPause: () => void;
  onReRecord: () => void;
  onConfirm: () => void;
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function RecordingBar({
  recordingState,
  duration,
  isPlaying,
  playbackProgress,
  onStop,
  onPlay,
  onPause,
  onReRecord,
  onConfirm,
}: RecordingBarProps) {
  if (recordingState === "idle") return null;

  if (recordingState === "recording") {
    return (
      <View style={styles.container}>
        <View style={styles.row}>
          <View style={styles.recDot} />
          <Text style={styles.timer}>{fmt(duration)}</Text>
          <TouchableOpacity
            testID="stop-button"
            style={styles.stopBtn}
            onPress={onStop}
            activeOpacity={0.7}
          >
            <Ionicons name="stop" size={20} color={colors.textInverse} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Playback state
  const progressPercent = `${(playbackProgress * 100).toFixed(1)}%`;

  return (
    <View style={styles.container}>
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: progressPercent as any }]}
        />
      </View>
      <View style={styles.row}>
        <TouchableOpacity
          testID="rerecord-button"
          style={styles.secondaryBtn}
          onPress={onReRecord}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryText}>REDO</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID={isPlaying ? "pause-button" : "play-button"}
          style={styles.playBtn}
          onPress={isPlaying ? onPause : onPlay}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={22}
            color={colors.textInverse}
          />
        </TouchableOpacity>

        <TouchableOpacity
          testID="confirm-button"
          style={styles.confirmBtn}
          onPress={onConfirm}
          activeOpacity={0.7}
        >
          <Text style={styles.confirmText}>DONE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    backgroundColor: colors.bg,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingVertical: 4,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  timer: {
    fontSize: 16,
    fontWeight: font.weight.bold,
    color: colors.text,
    letterSpacing: 1,
    minWidth: 56,
    textAlign: "center",
  },
  stopBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    height: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.primary,
  },
  playBtn: {
    width: 48,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  secondaryText: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: font.weight.semibold,
    color: colors.text,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  confirmText: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: font.weight.semibold,
    color: colors.textInverse,
  },
});
