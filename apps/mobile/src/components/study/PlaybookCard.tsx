import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type {
  PlaybookEntry,
  PlaybookMasteryStatus,
  SessionSpeakingFunction,
} from "@shadowoo/shared";

const FUNCTION_LABELS: Record<string, string> = {
  persuade: "PERSUADE",
  "explain-metric": "EXPLAIN METRIC",
  summarize: "SUMMARIZE",
  hedge: "HEDGE",
  disagree: "DISAGREE",
  propose: "PROPOSE",
  "answer-question": "Q&A",
};

const MASTERY_LABELS: Record<PlaybookMasteryStatus, string> = {
  new: "NEW",
  practicing: "PRACTICING",
  mastered: "MASTERED",
};

interface PlaybookCardProps {
  entry: PlaybookEntry;
  onCycleMastery: (entry: PlaybookEntry) => void;
}

export default function PlaybookCard({
  entry,
  onCycleMastery,
}: PlaybookCardProps) {
  const functionLabel = entry.speaking_function
    ? FUNCTION_LABELS[entry.speaking_function as SessionSpeakingFunction]
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.metaRow}>
        {functionLabel ? (
          <View style={styles.functionBadge}>
            <Text style={styles.functionText}>{functionLabel}</Text>
          </View>
        ) : null}
        <View style={styles.modeBadge}>
          <Text style={styles.modeText}>
            {entry.practice_mode.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>SOURCE</Text>
        <Text style={styles.sourceText}>{entry.source_sentence}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>MY REWRITE</Text>
        <Text style={styles.rewriteText}>{entry.user_rewrite}</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.masteryButton}
          onPress={() => onCycleMastery(entry)}
          activeOpacity={0.8}
        >
          <Text style={styles.masteryButtonText}>
            {MASTERY_LABELS[entry.mastery_status]}
          </Text>
        </TouchableOpacity>
        <Text style={styles.timestamp}>
          {new Date(
            entry.updated_at ?? entry.created_at ?? Date.now(),
          ).toLocaleDateString("ko-KR")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 10,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  functionBadge: {
    borderWidth: 1,
    borderColor: "#111111",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  functionText: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: "#111111",
    fontWeight: "700",
  },
  modeBadge: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F7F7F7",
  },
  modeText: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: "#666666",
    fontWeight: "600",
  },
  block: {
    gap: 4,
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.4,
    color: "#888888",
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
    color: "#111111",
    fontWeight: "600",
  },
  footer: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  masteryButton: {
    borderWidth: 1,
    borderColor: "#111111",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  masteryButtonText: {
    fontSize: 10,
    letterSpacing: 1.3,
    color: "#111111",
    fontWeight: "700",
  },
  timestamp: {
    fontSize: 11,
    color: "#888888",
  },
});
