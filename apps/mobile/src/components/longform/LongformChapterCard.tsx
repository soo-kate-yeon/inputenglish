import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SessionListItem } from "@/lib/api";
import { colors, font, radius, spacing } from "@/theme";

interface LongformChapterCardProps {
  session: SessionListItem;
  isActive: boolean;
  onPress: (session: SessionListItem) => void;
  isLast?: boolean;
}

function formatDuration(seconds?: number): string {
  const safe = Math.max(0, Math.round(seconds ?? 0));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;

  if (minutes > 0 && remaining > 0) {
    return `${minutes}분 ${remaining}초`;
  }

  if (minutes > 0) {
    return `${minutes}분`;
  }

  return `${remaining}초`;
}

export default function LongformChapterCard({
  session,
  isActive,
  onPress,
  isLast = false,
}: LongformChapterCardProps) {
  return (
    <Pressable
      style={[
        styles.row,
        isActive && styles.rowActive,
        !isLast && styles.rowWithDivider,
      ]}
      onPress={() => onPress(session)}
    >
      <View style={styles.copy}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>
            {session.title}
          </Text>
          <Text style={styles.durationLabel}>
            {formatDuration(session.duration)}
          </Text>
        </View>
        {session.expected_takeaway || session.description ? (
          <Text style={styles.body}>
            {session.expected_takeaway || session.description}
          </Text>
        ) : null}
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={isActive ? colors.textOnDark : colors.textOnDarkMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowActive: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radius.md,
  },
  rowWithDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderOnDark,
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  durationLabel: {
    flexShrink: 0,
    fontSize: font.size.sm,
    lineHeight: 18,
    color: colors.textOnDarkMuted,
  },
  title: {
    fontSize: font.size.base,
    lineHeight: 24,
    color: colors.textOnDark,
    fontWeight: font.weight.semibold,
  },
  body: {
    fontSize: font.size.sm,
    lineHeight: 20,
    color: colors.textOnDarkSecondary,
  },
});
