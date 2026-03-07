// @MX:NOTE: [AUTO] Fixed bottom bar for recording/playback UI in shadowing screen.
// @MX:SPEC: SPEC-MOBILE-004 - REQ-S-001, REQ-S-002, REQ-S-003, REQ-E-002, REQ-E-003, REQ-E-004
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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
  if (recordingState === "idle") {
    return null;
  }

  if (recordingState === "recording") {
    return (
      <View style={styles.container}>
        <View style={styles.row}>
          <View style={styles.pulseIndicator} />
          <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          <TouchableOpacity
            testID="stop-button"
            style={styles.stopButton}
            onPress={onStop}
            activeOpacity={0.7}
          >
            <Ionicons name="stop" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // playback state
  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View testID="progress-bar" style={styles.progressBarTrack}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${playbackProgress * 100}%` },
          ]}
        />
      </View>
      <View style={styles.row}>
        {/* Re-record button */}
        <TouchableOpacity
          testID="rerecord-button"
          style={styles.secondaryButton}
          onPress={onReRecord}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={20} color="#666" />
          <Text style={styles.secondaryButtonText}>다시</Text>
        </TouchableOpacity>

        {/* Play/Pause toggle */}
        {isPlaying ? (
          <TouchableOpacity
            testID="pause-button"
            style={styles.playButton}
            onPress={onPause}
            activeOpacity={0.7}
          >
            <Ionicons name="pause" size={28} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            testID="play-button"
            style={styles.playButton}
            onPress={onPlay}
            activeOpacity={0.7}
          >
            <Ionicons name="play" size={28} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Confirm button */}
        <TouchableOpacity
          testID="confirm-button"
          style={styles.confirmButton}
          onPress={onConfirm}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text style={styles.confirmButtonText}>확인</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingBottom: 24, // safe area offset
    paddingTop: 8,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 8,
  },
  pulseIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E53935",
    marginRight: 8,
  },
  durationText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    minWidth: 60,
    textAlign: "center",
    marginRight: 8,
  },
  stopButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E53935",
    alignItems: "center",
    justifyContent: "center",
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: "#eee",
    borderRadius: 2,
    marginBottom: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#007AFF",
    borderRadius: 2,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    gap: 4,
  },
  secondaryButtonText: {
    fontSize: 13,
    color: "#666",
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#34C759",
    gap: 4,
  },
  confirmButtonText: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "600",
  },
});
