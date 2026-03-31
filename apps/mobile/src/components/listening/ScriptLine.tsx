// @MX:NOTE: [AUTO] Renders a single sentence row with active highlight, loop, and save toggles.
// @MX:SPEC: SPEC-MOBILE-003 - REQ-E-002, REQ-E-003, REQ-E-004, REQ-E-005, REQ-S-001, AC-002
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Sentence } from "@inputenglish/shared";
import LoopToggle from "./LoopToggle";
import SaveToggle from "./SaveToggle";
import { colors, font } from "../../theme";

interface ScriptLineProps {
  sentence: Sentence;
  isActive: boolean;
  isLooping: boolean;
  isSaved: boolean;
  scriptHidden: boolean;
  showTranslation?: boolean;
  onTap: (sentence: Sentence) => void;
  onLoopToggle: (sentence: Sentence) => void;
  onSaveToggle: (sentence: Sentence) => void;
}

// No longer used for getItemLayout — height is dynamic (text wraps)
export const SCRIPT_LINE_HEIGHT = 76;

function ScriptLine({
  sentence,
  isActive,
  isLooping,
  isSaved,
  scriptHidden,
  showTranslation = false,
  onTap,
  onLoopToggle,
  onSaveToggle,
}: ScriptLineProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onTap(sentence)}
      activeOpacity={0.7}
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
          <Text style={styles.translation}>{sentence.translation}</Text>
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
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  text: {
    fontSize: font.size.base - 1,
    color: colors.textMuted,
    lineHeight: 24,
    fontWeight: font.weight.regular,
    flexWrap: "wrap",
  },
  textActive: {
    color: colors.text,
    fontWeight: font.weight.bold,
    fontSize: font.size.base,
    lineHeight: 26,
  },
  textHidden: {
    color: colors.border,
    letterSpacing: 4,
  },
  translation: {
    fontSize: font.size.sm,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 2,
  },
});
