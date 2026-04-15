import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, radius, spacing } from "../../theme";

interface ShadowingRecordButtonProps {
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function ShadowingRecordButton({
  disabled = false,
  onPress,
  style,
}: ShadowingRecordButtonProps) {
  return (
    <Pressable
      style={[styles.button, style, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name="mic" size={28} color={colors.textInverse} />
      <Text style={styles.text}>녹음 시작</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    backgroundColor: colors.bgInverse,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: font.size.md,
    color: colors.textInverse,
    fontWeight: font.weight.bold,
    letterSpacing: 0.2,
  },
});
