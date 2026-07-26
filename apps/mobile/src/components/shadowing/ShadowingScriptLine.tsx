// @MX:NOTE: [AUTO] Shadowing script line — bold active, wrap, editorial-tech theme.
// @MX:SPEC: SPEC-MOBILE-004 - REQ-E-001, REQ-C-001, REQ-C-002, AC-002
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Sentence } from "@inputenglish/shared";
import { colors, radius, font } from "../../theme";
import { appTokens } from "../../theme/app-tokens";

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
    paddingHorizontal: appTokens.spacing.n20,
    paddingVertical: appTokens.spacing.n14,
  },
  content: {
    flex: 1,
    marginRight: appTokens.spacing.n8,
  },
  text: {
    fontSize: font.size.base,
    color: colors.textMuted,
    lineHeight: appTokens.typography.n26,
    fontWeight: font.weight.regular,
  },
  textActive: {
    color: colors.text,
    fontWeight: font.weight.bold,
  },
  translation: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
    marginTop: appTokens.spacing.n6,
    lineHeight: appTokens.typography.n22,
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: appTokens.spacing.n4,
    gap: appTokens.spacing.n4,
  },
  recordingDot: {
    width: appTokens.size.n6,
    height: appTokens.size.n6,
    backgroundColor: colors.text,
  },
  recordingLabel: {
    fontSize: appTokens.typography.n9,
    letterSpacing: appTokens.typography.n1_5,
    fontWeight: font.weight.bold,
    color: colors.text,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: appTokens.spacing.n8,
    paddingTop: appTokens.spacing.n2,
  },
  recordBtn: {
    width: appTokens.size.n32,
    height: appTokens.size.n32,
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
