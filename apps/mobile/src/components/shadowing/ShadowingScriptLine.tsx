// @MX:NOTE: [AUTO] Shadowing script line — bold active, wrap, square minimalism.
// @MX:SPEC: SPEC-MOBILE-004 - REQ-E-001, REQ-C-001, REQ-C-002, AC-002
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Sentence } from "@shadowoo/shared";

interface ShadowingScriptLineProps {
  sentence: Sentence;
  isActive: boolean;
  hasRecording: boolean;
  isCurrentRecording: boolean;
  onRecord: (sentenceId: string) => void;
  onSeek: (sentenceId: string) => void;
  index: number;
}

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
      style={styles.container}
      onPress={() => onSeek(sentence.id)}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Text style={[styles.text, isActive && styles.textActive]}>
          {sentence.text}
        </Text>
        {isCurrentRecording && (
          <View
            testID="current-recording-indicator"
            style={styles.recordingIndicator}
          >
            <View style={styles.recordingDot} />
            <Text style={styles.recordingLabel}>REC</Text>
          </View>
        )}
      </View>
      <View style={styles.actions}>
        {hasRecording && (
          <View testID="recording-complete-indicator">
            <Ionicons name="checkmark" size={16} color="#111111" />
          </View>
        )}
        <TouchableOpacity
          testID="record-button"
          style={[
            styles.recordBtn,
            isCurrentRecording && styles.recordBtnActive,
          ]}
          onPress={() => onRecord(sentence.id)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isCurrentRecording ? "stop" : "mic"}
            size={16}
            color={isCurrentRecording ? "#fff" : "#111111"}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default memo(ShadowingScriptLine);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  text: {
    fontSize: 15,
    color: "#BBBBBB",
    lineHeight: 24,
    fontWeight: "400",
  },
  textActive: {
    color: "#111111",
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 26,
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  recordingDot: {
    width: 6,
    height: 6,
    backgroundColor: "#111111",
  },
  recordingLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
    color: "#111111",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 2,
  },
  recordBtn: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  recordBtnActive: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },
});
