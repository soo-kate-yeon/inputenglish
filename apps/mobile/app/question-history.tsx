import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { useTheme } from "@/components/ui";
import QuestionHistoryTab from "@/components/premium/QuestionHistoryTab";
import { appTokens } from "../src/theme/app-tokens";

/**
 * /question-history — re-readable list of asked items (SPEC-INPUT-001 REQ-INPUT-004-E2).
 * Follows the app color mode (not immersive).
 */
export default function QuestionHistoryRoute() {
  const theme = useTheme();
  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background.canvas }]}
      edges={["top", "left", "right"]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={12}
          onPress={() => router.back()}
          style={[styles.back, { backgroundColor: theme.colors.surface.muted }]}
        >
          <Text style={[styles.backIcon, { color: theme.colors.text.primary }]}>
            ‹
          </Text>
        </Pressable>
        <Text
          style={[
            theme.typography.bodyStrong,
            { color: theme.colors.text.primary },
          ]}
        >
          질문 히스토리
        </Text>
        <View style={styles.back} />
      </View>
      <QuestionHistoryTab />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: appTokens.spacing.n16,
    paddingVertical: appTokens.spacing.n12,
  },
  back: {
    width: appTokens.size.n36,
    height: appTokens.size.n36,
    borderRadius: appTokens.radius.n999,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: appTokens.typography.n24,
    lineHeight: appTokens.typography.n28,
  },
});
