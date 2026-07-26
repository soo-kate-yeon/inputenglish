// @MX:NOTE: [AUTO] Shadowing screen header with mode toggle — editorial-tech pill tabs.
// @MX:SPEC: SPEC-MOBILE-004 - REQ-E-005, AC-005
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius, font } from "../../theme";
import { appTokens } from "../../theme/app-tokens";

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
    borderBottomColor: colors.border,
    paddingHorizontal: appTokens.spacing.n8,
    paddingVertical: appTokens.spacing.n6,
    gap: appTokens.spacing.n4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: appTokens.spacing.n7,
    alignItems: "center",
    borderRadius: radius.pill,
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
  },
  modeText: {
    fontSize: appTokens.typography.n10,
    letterSpacing: appTokens.typography.n2,
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
  },
  modeTextActive: {
    color: colors.textInverse,
  },
});
