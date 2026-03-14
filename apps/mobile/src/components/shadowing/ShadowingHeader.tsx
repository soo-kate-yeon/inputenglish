// @MX:NOTE: [AUTO] Shadowing screen header with mode toggle — square minimalism.
// @MX:SPEC: SPEC-MOBILE-004 - REQ-E-005, AC-005
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type ShadowingMode = "sentence" | "paragraph" | "total";

interface ShadowingHeaderProps {
  title: string;
  mode: ShadowingMode;
  onModeChange: (mode: ShadowingMode) => void;
  onExit: () => void;
}

const MODES: Array<{ key: ShadowingMode; label: string }> = [
  { key: "sentence", label: "SENTENCE" },
  { key: "paragraph", label: "PARAGRAPH" },
  { key: "total", label: "TOTAL" },
];

export default function ShadowingHeader({
  mode,
  onModeChange,
}: ShadowingHeaderProps) {
  return (
    <View style={styles.container}>
      {MODES.map(({ key, label }) => (
        <TouchableOpacity
          key={key}
          style={[styles.modeBtn, mode === key && styles.modeBtnActive]}
          onPress={() => onModeChange(key)}
        >
          <Text
            style={[styles.modeText, mode === key && styles.modeTextActive]}
          >
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  modeBtnActive: {
    borderBottomColor: "#111111",
  },
  modeText: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    color: "#AAAAAA",
  },
  modeTextActive: {
    color: "#111111",
  },
});
