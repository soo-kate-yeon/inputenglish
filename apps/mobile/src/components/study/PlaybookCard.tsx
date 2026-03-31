import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import BottomSheet from "../common/BottomSheet";
import type {
  PlaybookEntry,
  PlaybookMasteryStatus,
  SessionSpeakingFunction,
} from "@inputenglish/shared";
import {
  PLAYBOOK_MASTERY_LABELS,
  SPEAKING_FUNCTION_LABELS,
} from "../../lib/professional-labels";
import { colors, radius, font } from "../../theme";

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
  const [masteryOpen, setMasteryOpen] = useState(false);

  const functionLabel = entry.speaking_function
    ? SPEAKING_FUNCTION_LABELS[
        entry.speaking_function as SessionSpeakingFunction
      ]
    : null;

  return (
    <View style={styles.card}>
      {/* Session reference */}
      {sessionTitle ? (
        <TouchableOpacity
          style={styles.sessionRef}
          onPress={() =>
            router.push(
              `/study/${entry.source_video_id}?sessionId=${entry.session_id}`,
            )
          }
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.sessionRefText} numberOfLines={1}>
            {sessionTitle}
          </Text>
          <Text style={styles.sessionRefArrow}>→</Text>
        </TouchableOpacity>
      ) : null}

      {/* Source sentence */}
      <View style={styles.block}>
        <Text style={styles.label}>원문</Text>
        <Text style={styles.sourceText}>{entry.source_sentence}</Text>
      </View>

      {/* User rewrite — the main content */}
      <Text style={styles.rewriteText}>{entry.user_rewrite}</Text>

      {/* Footer: tags + mastery dropdown */}
      <View style={styles.footer}>
        <View style={styles.tagRow}>
          {functionLabel ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{functionLabel}</Text>
            </View>
          ) : null}
          <Text style={styles.timestamp}>
            {new Date(
              entry.updated_at ?? entry.created_at ?? Date.now(),
            ).toLocaleDateString("ko-KR")}
          </Text>
        </View>

        {/* Mastery dropdown */}
        <TouchableOpacity
          style={styles.masteryTrigger}
          onPress={() => setMasteryOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.masteryTriggerText}>
            {PLAYBOOK_MASTERY_LABELS[entry.mastery_status]}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.text} />
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
                  color={colors.textInverse}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg,
    padding: 16,
    gap: 10,
  },

  // Session reference
  sessionRef: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
  },
  sessionRefText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: font.weight.medium,
    letterSpacing: 0.3,
    flex: 1,
  },
  sessionRefArrow: {
    fontSize: 10,
    color: colors.textMuted,
  },

  // Content
  block: {
    gap: 4,
  },
  label: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: font.weight.bold,
  },
  sourceText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  rewriteText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  tag: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.bgMuted,
  },
  tagText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: font.weight.semibold,
  },
  timestamp: {
    fontSize: 11,
    color: colors.textMuted,
  },

  // Mastery dropdown trigger
  masteryTrigger: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  masteryTriggerText: {
    fontSize: 10,
    color: colors.text,
    fontWeight: font.weight.bold,
  },

  // Bottom sheet content
  sheetTitle: {
    fontSize: 10,
    fontWeight: font.weight.bold,
    letterSpacing: 2,
    color: colors.textMuted,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sheetItemActive: {
    backgroundColor: colors.text,
  },
  sheetItemText: {
    fontSize: 15,
    fontWeight: font.weight.semibold,
    color: colors.text,
  },
  sheetItemTextActive: {
    color: colors.textInverse,
  },
});
