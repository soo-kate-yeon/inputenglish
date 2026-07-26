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
import { appTokens } from "../../theme/app-tokens";

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
      <View testID="progress-bar" style={styles.progressTrack}>
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
    paddingTop: appTokens.spacing.n12,
    paddingHorizontal: appTokens.spacing.n20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: appTokens.spacing.n20,
    paddingVertical: appTokens.spacing.n4,
  },
  recDot: {
    width: appTokens.size.n8,
    height: appTokens.size.n8,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  timer: {
    fontSize: appTokens.typography.n16,
    fontWeight: font.weight.bold,
    color: colors.text,
    letterSpacing: appTokens.typography.n1,
    minWidth: appTokens.size.n56,
    textAlign: "center",
  },
  stopBtn: {
    width: appTokens.size.n44,
    height: appTokens.size.n44,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    height: appTokens.size.n2,
    backgroundColor: colors.border,
    marginBottom: appTokens.spacing.n12,
  },
  progressFill: {
    height: appTokens.size.n2,
    backgroundColor: colors.primary,
  },
  playBtn: {
    width: appTokens.size.n48,
    height: appTokens.size.n48,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: appTokens.spacing.n16,
    paddingVertical: appTokens.spacing.n8,
  },
  secondaryText: {
    fontSize: appTokens.typography.n10,
    letterSpacing: appTokens.typography.n1_5,
    fontWeight: font.weight.semibold,
    color: colors.text,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: appTokens.spacing.n20,
    paddingVertical: appTokens.spacing.n10,
  },
  confirmText: {
    fontSize: appTokens.typography.n10,
    letterSpacing: appTokens.typography.n1_5,
    fontWeight: font.weight.semibold,
    color: colors.textInverse,
  },
});
