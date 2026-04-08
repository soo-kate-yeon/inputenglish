// @MX:NOTE: [AUTO] Shadowing script line — bold active, wrap, editorial-tech theme.
// @MX:SPEC: SPEC-MOBILE-004 - REQ-E-001, REQ-C-001, REQ-C-002, AC-002
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Sentence } from "@inputenglish/shared";
import { colors, radius, font } from "../../theme";

interface ShadowingScriptLineProps {
  sentence: Sentence;
  isActive: boolean;
  hasRecording: boolean;
  isCurrentRecording: boolean;
  showTranslation?: boolean;
  onRecord: (sentenceId: string) => void;
  onSeek: (sentenceId: string) => void;
  onLongPress?: (sentence: Sentence) => void;
  index: number;
}

export const SHADOWING_SCRIPT_LINE_HEIGHT = 76;

function ShadowingScriptLine({
  sentence,
  isActive,
  hasRecording,
  isCurrentRecording,
  showTranslation = false,
  onRecord,
  onSeek,
  onLongPress,
}: ShadowingScriptLineProps) {
  return (
    <TouchableOpacity
      testID="sentence-row"
      style={styles.container}
      onPress={() => onSeek(sentence.id)}
      onLongPress={onLongPress ? () => onLongPress(sentence) : undefined}
      delayLongPress={400}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Text style={[styles.text, isActive && styles.textActive]}>
          {sentence.text}
        </Text>
        {showTranslation && sentence.translation ? (
          <Text style={styles.translation}>{sentence.translation}</Text>
        ) : null}
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
            <Ionicons name="checkmark" size={16} color={colors.text} />
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
            color={isCurrentRecording ? colors.textInverse : colors.text}
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
    paddingVertical: 14,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  text: {
    fontSize: font.size.base,
    color: colors.textMuted,
    lineHeight: 26,
    fontWeight: font.weight.regular,
  },
  textActive: {
    color: colors.text,
    fontWeight: font.weight.bold,
    fontSize: font.size.lg,
    lineHeight: 30,
  },
  translation: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 22,
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
    backgroundColor: colors.text,
  },
  recordingLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: font.weight.bold,
    color: colors.text,
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
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  recordBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
