// @MX:SPEC: SPEC-MOBILE-003 - AC-002 (script show/hide)
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors, font } from "../../theme";
import { appTokens } from "../../theme/app-tokens";

interface ScriptToggleProps {
  hidden: boolean;
  onPress: () => void;
}

export default function ScriptToggle({ hidden, onPress }: ScriptToggleProps) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.text}>{hidden ? "자막 보기" : "자막 숨기기"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: appTokens.spacing.n8,
    paddingHorizontal: appTokens.spacing.n16,
    backgroundColor: colors.bgSubtle,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: "center",
  },
  text: {
    fontSize: font.size.sm,
    color: colors.primary,
    fontWeight: font.weight.medium,
  },
});
