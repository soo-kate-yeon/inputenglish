// @MX:SPEC: SPEC-MOBILE-003 - AC-002 (script show/hide)
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

interface ScriptToggleProps {
  hidden: boolean;
  onPress: () => void;
}

export default function ScriptToggle({ hidden, onPress }: ScriptToggleProps) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.text}>
        {hidden ? "스크립트 보기" : "스크립트 숨기기"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#f8f8f8",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    alignItems: "center",
  },
  text: {
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "500",
  },
});
