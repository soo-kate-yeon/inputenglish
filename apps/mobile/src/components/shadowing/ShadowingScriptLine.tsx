// @MX:NOTE: [AUTO] Renders a single sentence row with recording state indicators and record button.
// @MX:SPEC: SPEC-MOBILE-004 - REQ-E-001, REQ-C-001, REQ-C-002, AC-002
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Sentence } from "@shadowoo/shared";

interface ShadowingScriptLineProps {
  sentence: Sentence;
  isActive: boolean;
  hasRecording: boolean;
  isCurrentRecording: boolean; // currently being recorded
  onRecord: (sentenceId: string) => void;
  onSeek: (sentenceId: string) => void;
  index: number;
}

// Exported for FlatList getItemLayout (fixed row height)
export const SHADOWING_SCRIPT_LINE_HEIGHT = 76;

function ShadowingScriptLine({
  sentence,
  isActive,
  hasRecording,
  isCurrentRecording,
  onRecord,
  onSeek,
}: ShadowingScriptLineProps) {
  return (
    <TouchableOpacity
      testID="sentence-row"
      style={[
        styles.container,
        isActive && styles.containerActive,
        isCurrentRecording && styles.containerRecording,
      ]}
      onPress={() => onSeek(sentence.id)}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Text style={[styles.text, isActive && styles.textActive]}>
          {sentence.text}
        </Text>
        {/* Status indicators */}
        {isCurrentRecording && (
          <View
            testID="current-recording-indicator"
            style={styles.recordingIndicator}
          >
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>녹음 중</Text>
          </View>
        )}
      </View>
      <View style={styles.actions}>
        {hasRecording && (
          <View
            testID="recording-complete-indicator"
            style={styles.completeIndicator}
          >
            <Ionicons name="checkmark-circle" size={18} color="#34C759" />
          </View>
        )}
        <TouchableOpacity
          testID="record-button"
          style={[
            styles.recordButton,
            isCurrentRecording && styles.recordButtonActive,
          ]}
          onPress={() => onRecord(sentence.id)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isCurrentRecording ? "stop" : "mic"}
            size={18}
            color={isCurrentRecording ? "#fff" : "#007AFF"}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default memo(ShadowingScriptLine);

const styles = StyleSheet.create({
  container: {
    height: SHADOWING_SCRIPT_LINE_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  containerActive: {
    backgroundColor: "#EBF4FF",
  },
  containerRecording: {
    backgroundColor: "#FFF3F3",
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  text: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
  },
  textActive: {
    color: "#007AFF",
    fontWeight: "600",
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  recordingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E53935",
  },
  recordingText: {
    fontSize: 11,
    color: "#E53935",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  completeIndicator: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  recordButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EBF4FF",
    alignItems: "center",
    justifyContent: "center",
  },
  recordButtonActive: {
    backgroundColor: "#E53935",
  },
});
