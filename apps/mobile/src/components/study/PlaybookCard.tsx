import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import type {
  PlaybookEntry,
  PlaybookMasteryStatus,
  SessionSpeakingFunction,
} from "@shadowoo/shared";
import {
  PLAYBOOK_MASTERY_LABELS,
  SPEAKING_FUNCTION_LABELS,
} from "../../lib/professional-labels";

const COLOR = {
  bg: "#FFFFFF",
  border: "#111111",
  borderLight: "#E0E0E0",
  text: "#111111",
  textMuted: "#888888",
  textInverse: "#FFFFFF",
};

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
          <Text style={styles.masteryArrow}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* Mastery dropdown modal */}
      <Modal visible={masteryOpen} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setMasteryOpen(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>숙련도</Text>
            {MASTERY_OPTIONS.map((opt) => {
              const active = opt.key === entry.mastery_status;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.menuItem, active && styles.menuItemActive]}
                  onPress={() => {
                    onSetMastery(entry, opt.key);
                    setMasteryOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.menuItemText,
                      active && styles.menuItemTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLOR.bg,
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
    color: COLOR.textMuted,
    fontWeight: "500",
    letterSpacing: 0.3,
    flex: 1,
  },
  sessionRefArrow: {
    fontSize: 10,
    color: COLOR.textMuted,
  },

  // Content
  block: {
    gap: 4,
  },
  label: {
    fontSize: 10,
    color: COLOR.textMuted,
    fontWeight: "700",
  },
  sourceText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#666666",
  },
  rewriteText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLOR.text,
    fontWeight: "600",
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
    borderColor: COLOR.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#F7F7F7",
  },
  tagText: {
    fontSize: 10,
    color: COLOR.textMuted,
    fontWeight: "600",
  },
  timestamp: {
    fontSize: 11,
    color: COLOR.textMuted,
  },

  // Mastery dropdown trigger
  masteryTrigger: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLOR.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  masteryTriggerText: {
    fontSize: 10,
    color: COLOR.text,
    fontWeight: "700",
  },
  masteryArrow: {
    fontSize: 8,
    color: COLOR.text,
  },

  // Dropdown modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  menu: {
    backgroundColor: COLOR.bg,
    borderWidth: 1,
    borderColor: COLOR.border,
    width: "100%",
    maxWidth: 240,
    paddingVertical: 8,
  },
  menuTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: COLOR.textMuted,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemActive: {
    backgroundColor: COLOR.text,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLOR.text,
  },
  menuItemTextActive: {
    color: COLOR.textInverse,
  },
});
