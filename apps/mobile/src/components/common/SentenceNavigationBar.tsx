import React from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme, createThemedStyles } from "@/components/ui";

interface SentenceNavigationBarProps {
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  tone?: "light" | "dark";
  style?: StyleProp<ViewStyle>;
}

const getStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: theme.spacing[1],
    width: "100%",
  },
  button: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing[1],
    borderRadius: theme.radius.lg,
  },
  buttonDark: {
    backgroundColor: theme.colors.text.primary,
  },
  buttonLight: {
    backgroundColor: theme.colors.background.muted,
  },
  buttonDisabled: {
    opacity: 0.42,
  },
  label: {
    ...theme.typography.label,
    lineHeight: 20,
  },
  labelDark: {
    color: theme.colors.text.inverse,
  },
  labelLight: {
    color: theme.colors.text.primary,
  },
  labelDisabled: {
    color: theme.colors.text.tertiary,
  },
}));

export default function SentenceNavigationBar({
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  tone = "dark",
  style,
}: SentenceNavigationBarProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
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
                ? theme.colors.text.inverse
                : theme.colors.text.primary
              : theme.colors.text.tertiary
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
                ? theme.colors.text.inverse
                : theme.colors.text.primary
              : theme.colors.text.tertiary
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
