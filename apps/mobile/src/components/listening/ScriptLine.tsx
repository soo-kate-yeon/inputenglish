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
  tone?: "light" | "dark";
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
  tone = "light",
  showTranslation = false,
  onTap,
  onLongPress,
  onLoopToggle,
  onSaveToggle,
}: ScriptLineProps) {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        tone === "dark" && styles.containerDark,
        isActive && styles.containerActive,
        isActive && tone === "dark" && styles.containerDarkActive,
      ]}
      onPress={() => onTap(sentence)}
      onLongPress={onLongPress ? () => onLongPress(sentence) : undefined}
      delayLongPress={400}
      activeOpacity={0.85}
    >
      <View style={styles.content}>
        <Text
          style={[
            styles.text,
            tone === "dark" && styles.textDark,
            isActive && styles.textActive,
            isActive && tone === "dark" && styles.textDarkActive,
            scriptHidden && styles.textHidden,
            scriptHidden && tone === "dark" && styles.textHiddenDark,
          ]}
        >
          {scriptHidden ? "• • •" : sentence.text}
        </Text>
        {showTranslation && sentence.translation ? (
          <Text
            style={[
              styles.translation,
              tone === "dark" && styles.translationDark,
              isActive && styles.translationActive,
              isActive && tone === "dark" && styles.translationDarkActive,
            ]}
          >
            {sentence.translation}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        <LoopToggle
          active={isLooping}
          tinted={tone === "dark"}
          onPress={() => onLoopToggle(sentence)}
        />
        <SaveToggle
          active={isSaved}
          tinted={tone === "dark"}
          onPress={() => onSaveToggle(sentence)}
        />
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
  containerDark: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderOnDark,
    backgroundColor: "transparent",
  },
  containerDarkActive: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },

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
  textDark: {
    color: colors.textOnDarkMuted,
  },
  textActive: {
    color: colors.text,
    fontWeight: font.weight.medium,
  },
  textDarkActive: {
    color: colors.textOnDark,
  },
  textHidden: {
    color: colors.border,
    letterSpacing: 4,
  },
  textHiddenDark: {
    color: colors.borderOnDarkStrong,
  },

  translation: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  translationActive: {
    color: colors.textSecondary,
  },
  translationDark: {
    color: colors.textOnDarkSecondary,
  },
  translationDarkActive: {
    color: colors.textOnDarkSecondary,
  },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 2,
  },
});
