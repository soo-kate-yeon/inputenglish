// @MX:NOTE: [AUTO] Display card for AI-generated tips and tag badges.
// Shows tip text with tag chips, and an error state with retry affordance.
// @MX:SPEC: SPEC-MOBILE-006

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface AiTipCardProps {
  tip: string;
  tags: string[];
  onRetry?: () => void;
  error?: string | null;
}

export default function AiTipCard({
  tip,
  tags,
  onRetry,
  error,
}: AiTipCardProps) {
  if (error) {
    return (
      <View style={[styles.card, styles.errorCard]}>
        <Text style={styles.errorText}>{error}</Text>
        {onRetry ? (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
          >
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (!tip) return null;

  return (
    <View style={styles.card}>
      {tags.length > 0 ? (
        <View style={styles.tagsRow}>
          {tags.map((tag) => (
            <View key={tag} style={styles.badge}>
              <Text style={styles.badgeText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={styles.tipText}>{tip}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F0F8FF",
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#C5E0FF",
  },
  errorCard: {
    backgroundColor: "#FFF0F0",
    borderColor: "#FFCDD2",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  badge: {
    backgroundColor: "#007AFF",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#1C1C1E",
  },
  errorText: {
    fontSize: 14,
    color: "#C0392B",
    marginBottom: 10,
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#FF3B30",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
});
