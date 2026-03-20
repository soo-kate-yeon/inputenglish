// @MX:NOTE: [AUTO] Renders a single sentence row with active highlight, loop, and save toggles.
// @MX:SPEC: SPEC-MOBILE-003 - REQ-E-002, REQ-E-003, REQ-E-004, REQ-E-005, REQ-S-001, AC-002
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Sentence } from "@inputenglish/shared";
import LoopToggle from "./LoopToggle";
import SaveToggle from "./SaveToggle";

interface ScriptLineProps {
  sentence: Sentence;
  isActive: boolean;
  isLooping: boolean;
  isSaved: boolean;
  scriptHidden: boolean;
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
        {sentence.translation ? (
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
    flexWrap: "wrap",
  },
  textActive: {
    color: "#111111",
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 26,
  },
  textHidden: {
    color: "#DDDDDD",
    letterSpacing: 4,
  },
  translation: {
    fontSize: 12,
    color: "#BBBBBB",
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
