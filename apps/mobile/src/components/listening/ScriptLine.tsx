// @MX:NOTE: [AUTO] Renders a single sentence row with active highlight, loop, and save toggles.
// @MX:SPEC: SPEC-MOBILE-003 - REQ-E-002, REQ-E-003, REQ-E-004, REQ-E-005, REQ-S-001, AC-002
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Sentence } from "@shadowoo/shared";
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

// Exported for FlatList getItemLayout (fixed row height)
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
      style={[styles.container, isActive && styles.containerActive]}
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
          <Text style={styles.translation} numberOfLines={1}>
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
  container: {
    height: SCRIPT_LINE_HEIGHT,
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
  textHidden: {
    color: "#ccc",
    letterSpacing: 4,
  },
  translation: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
