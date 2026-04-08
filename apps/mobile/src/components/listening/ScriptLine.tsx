// @MX:NOTE: [AUTO] Renders a single sentence row with active highlight, loop, and save toggles.
// @MX:SPEC: SPEC-MOBILE-003 - REQ-E-002, REQ-E-003, REQ-E-004, REQ-E-005, REQ-S-001, AC-002
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Sentence } from "@inputenglish/shared";
import LoopToggle from "./LoopToggle";
import SaveToggle from "./SaveToggle";
import { colors, font, radius, shadow } from "../../theme";

interface ScriptLineProps {
  sentence: Sentence;
  isActive: boolean;
  isLooping: boolean;
  isSaved: boolean;
  scriptHidden: boolean;
  showTranslation?: boolean;
  onTap: (sentence: Sentence) => void;
  onLongPress?: (sentence: Sentence) => void;
  onLoopToggle: (sentence: Sentence) => void;
  onSaveToggle: (sentence: Sentence) => void;
}

export const SCRIPT_LINE_HEIGHT = 76;

function ScriptLine({
  sentence,
  isActive,
  isLooping,
  isSaved,
  scriptHidden,
  showTranslation = false,
  onTap,
  onLongPress,
  onLoopToggle,
  onSaveToggle,
}: ScriptLineProps) {
  return (
    <TouchableOpacity
      style={[styles.container, isActive && styles.containerActive]}
      onPress={() => onTap(sentence)}
      onLongPress={onLongPress ? () => onLongPress(sentence) : undefined}
      delayLongPress={400}
      activeOpacity={0.85}
    >
      <View style={styles.content}>
        <Text
          style={[
            styles.text,
            isActive && styles.textActive,
            scriptHidden && styles.textHidden,
          ]}
        >
          {scriptHidden ? "• • •" : sentence.text}
        </Text>
        {showTranslation && sentence.translation ? (
          <Text
            style={[styles.translation, isActive && styles.translationActive]}
          >
            {sentence.translation}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        <LoopToggle active={isLooping} onPress={() => onLoopToggle(sentence)} />
        <SaveToggle active={isSaved} onPress={() => onSaveToggle(sentence)} />
      </View>
    </TouchableOpacity>
  );
}

export default memo(ScriptLine);

const styles = StyleSheet.create({
  // Inactive: crisp white list surface
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  containerActive: {},

  content: {
    flex: 1,
    marginRight: 10,
    gap: 6,
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
  textHidden: {
    color: colors.border,
    letterSpacing: 4,
  },

  translation: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  translationActive: {
    color: colors.textSecondary,
  },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 2,
  },
});
