// @MX:SPEC: SPEC-MOBILE-003 - REQ-E-005, AC-005
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme";
import { appTokens } from "../../theme/app-tokens";

interface SaveToggleProps {
  active: boolean;
  onPress: () => void;
  tinted?: boolean;
}

export default function SaveToggle({
  active,
  onPress,
  tinted = false,
}: SaveToggleProps) {
  return (
    <TouchableOpacity
      testID="save-toggle"
      style={[
        styles.button,
        tinted ? styles.buttonTinted : styles.buttonDefault,
        active && (tinted ? styles.buttonTintedActive : styles.buttonActive),
      ]}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.7}
    >
      <Ionicons
        name={active ? "bookmark" : "bookmark-outline"}
        size={14}
        color={
          active
            ? tinted
              ? colors.bgInverse
              : colors.textInverse
            : tinted
              ? "rgba(255,255,255,0.5)"
              : colors.textSecondary
        }
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: appTokens.size.n32,
    height: appTokens.size.n32,
    borderRadius: appTokens.radius.n16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  buttonDefault: {
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  buttonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  buttonTinted: {
    borderColor: appTokens.color.va5a9c1a4,
    backgroundColor: appTokens.color.vbfeccfcf,
  },
  buttonTintedActive: {
    backgroundColor: appTokens.color.v0752d421,
    borderColor: appTokens.color.v0752d421,
  },
});
