import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "../common/BottomSheet";
import type {
  PlaybookEntry,
  PlaybookMasteryStatus,
} from "@inputenglish/shared";
import { PLAYBOOK_MASTERY_LABELS } from "../../lib/professional-labels";
import { createThemedStyles, useTheme } from "@/components/ui";

const MASTERY_OPTIONS: { key: PlaybookMasteryStatus; label: string }[] = [
  { key: "new", label: PLAYBOOK_MASTERY_LABELS.new },
  { key: "practicing", label: PLAYBOOK_MASTERY_LABELS.practicing },
  { key: "mastered", label: PLAYBOOK_MASTERY_LABELS.mastered },
];

interface PlaybookCardProps {
  entry: PlaybookEntry;
  sessionTitle?: string;
  onSetMastery: (entry: PlaybookEntry, status: PlaybookMasteryStatus) => void;
}

export default function PlaybookCard({
  entry,
  sessionTitle,
  onSetMastery,
}: PlaybookCardProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [masteryOpen, setMasteryOpen] = useState(false);

  return (
    <View style={styles.card}>
      {/* Session reference (non-interactive label) */}
      {sessionTitle ? (
        <View style={styles.sessionRef}>
          <Text style={styles.sessionRefText} numberOfLines={1}>
            {sessionTitle}
          </Text>
        </View>
      ) : null}

      {/* Source sentence */}
      <View style={styles.block}>
        <Text style={styles.label}>원문</Text>
        <Text style={styles.sourceText}>{entry.source_sentence}</Text>
      </View>

      {/* User rewrite — the main content (hidden for bookmark-only entries) */}
      {entry.practice_mode === "bookmark" ? (
        <View style={styles.bookmarkBadge}>
          <Ionicons
            name="bookmark"
            size={12}
            color={theme.colors.text.secondary}
          />
          <Text style={styles.bookmarkText}>북마크한 표현</Text>
        </View>
      ) : (
        <Text style={styles.rewriteText}>{entry.user_rewrite}</Text>
      )}

      {/* Footer: timestamp + mastery dropdown */}
      <View style={styles.footer}>
        <View style={styles.tagRow}>
          <Text style={styles.timestamp}>
            {new Date(
              entry.updated_at ?? entry.created_at ?? Date.now(),
            ).toLocaleDateString("ko-KR")}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.masteryTrigger}
          onPress={() => setMasteryOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.masteryTriggerText}>
            {PLAYBOOK_MASTERY_LABELS[entry.mastery_status]}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={theme.colors.text.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Mastery bottom sheet */}
      <BottomSheet visible={masteryOpen} onClose={() => setMasteryOpen(false)}>
        <Text style={styles.sheetTitle}>숙련도</Text>
        {MASTERY_OPTIONS.map((opt) => {
          const active = opt.key === entry.mastery_status;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sheetItem, active && styles.sheetItemActive]}
              onPress={() => {
                onSetMastery(entry, opt.key);
                setMasteryOpen(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sheetItemText,
                  active && styles.sheetItemTextActive,
                ]}
              >
                {opt.label}
              </Text>
              {active && (
                <Ionicons
                  name="checkmark"
                  size={18}
                  color={theme.colors.text.inverse}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </BottomSheet>
    </View>
  );
}

const getStyles = createThemedStyles((theme) => ({
  card: {
    backgroundColor: theme.colors.surface.base,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    padding: theme.spacing[4],
    gap: theme.spacing[2],
  },
  sessionRef: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[1],
  },
  sessionRefText: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    flex: 1,
  },
  block: {
    gap: theme.spacing[1],
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    color: theme.colors.text.tertiary,
  },
  sourceText: {
    ...theme.typography.body,
    color: theme.colors.text.primary,
  },
  rewriteText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text.primary,
  },
  bookmarkBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  bookmarkText: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing[1],
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    flex: 1,
  },
  timestamp: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
  },
  masteryTrigger: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    gap: theme.spacing[1],
  },
  masteryTriggerText: {
    ...theme.typography.label,
    color: theme.colors.text.primary,
  },
  sheetTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: theme.colors.text.tertiary,
    paddingHorizontal: theme.spacing[5],
    paddingBottom: theme.spacing[3],
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[3],
  },
  sheetItemActive: {
    backgroundColor: theme.colors.text.primary,
  },
  sheetItemText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text.primary,
  },
  sheetItemTextActive: {
    color: theme.colors.text.inverse,
  },
}));
