import React from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, font, radius, spacing } from "@/theme";

interface SentenceNavigationBarProps {
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  tone?: "light" | "dark";
  style?: StyleProp<ViewStyle>;
}

export default function SentenceNavigationBar({
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  tone = "dark",
  style,
}: SentenceNavigationBarProps) {
  const isDark = tone === "dark";

  return (
    <View style={[styles.row, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="이전 문장으로 이동"
        style={[
          styles.button,
          isDark ? styles.buttonDark : styles.buttonLight,
          !hasPrev && styles.buttonDisabled,
        ]}
        onPress={onPrev}
        disabled={!hasPrev}
      >
        <Ionicons
          name="arrow-up"
          size={18}
          color={
            hasPrev
              ? isDark
                ? colors.textOnDark
                : colors.text
              : isDark
                ? colors.textOnDarkMuted
                : colors.textMuted
          }
        />
        <Text
          style={[
            styles.label,
            isDark ? styles.labelDark : styles.labelLight,
            !hasPrev && styles.labelDisabled,
          ]}
        >
          이전으로
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="다음 문장으로 이동"
        style={[
          styles.button,
          isDark ? styles.buttonDark : styles.buttonLight,
          !hasNext && styles.buttonDisabled,
        ]}
        onPress={onNext}
        disabled={!hasNext}
      >
        <Ionicons
          name="arrow-down"
          size={18}
          color={
            hasNext
              ? isDark
                ? colors.textOnDark
                : colors.text
              : isDark
                ? colors.textOnDarkMuted
                : colors.textMuted
          }
        />
        <Text
          style={[
            styles.label,
            isDark ? styles.labelDark : styles.labelLight,
            !hasNext && styles.labelDisabled,
          ]}
        >
          다음으로
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: spacing.xs,
    width: "100%",
  },
  button: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.lg,
  },
  buttonDark: {
    backgroundColor: colors.bgDarkSubtle,
  },
  buttonLight: {
    backgroundColor: colors.bgMuted,
  },
  buttonDisabled: {
    opacity: 0.42,
  },
  label: {
    fontSize: font.size.sm,
    lineHeight: 20,
    fontWeight: font.weight.medium,
  },
  labelDark: {
    color: colors.textOnDark,
  },
  labelLight: {
    color: colors.text,
  },
  labelDisabled: {
    color: colors.textMuted,
  },
});
