// @MX:NOTE: [AUTO] Display card for AI-generated tips and tag badges.
// Shows tip text with tag chips, and an error state with retry affordance.
// @MX:SPEC: SPEC-MOBILE-006

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { appTokens } from "../../theme/app-tokens";

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
    backgroundColor: appTokens.color.va972d2de,
    borderRadius: appTokens.radius.n12,
    padding: appTokens.spacing.n14,
    marginHorizontal: appTokens.spacing.n12,
    marginVertical: appTokens.spacing.n6,
    borderWidth: 1,
    borderColor: appTokens.color.v57650733,
  },
  errorCard: {
    backgroundColor: appTokens.color.v9de549be,
    borderColor: appTokens.color.vfae9454e,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: appTokens.spacing.n6,
    marginBottom: appTokens.spacing.n8,
  },
  badge: {
    backgroundColor: appTokens.color.v3f34b586,
    borderRadius: appTokens.radius.n10,
    paddingHorizontal: appTokens.spacing.n10,
    paddingVertical: appTokens.spacing.n3,
  },
  badgeText: {
    fontSize: appTokens.typography.n11,
    fontWeight: appTokens.typography.n600,
    color: appTokens.color.vd14f9016,
  },
  tipText: {
    fontSize: appTokens.typography.n14,
    lineHeight: appTokens.typography.n20,
    color: appTokens.color.v37e5401c,
  },
  errorText: {
    fontSize: appTokens.typography.n14,
    color: appTokens.color.v893e59a8,
    marginBottom: appTokens.spacing.n10,
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: appTokens.color.v82241aef,
    paddingHorizontal: appTokens.spacing.n14,
    paddingVertical: appTokens.spacing.n7,
    borderRadius: appTokens.radius.n8,
  },
  retryButtonText: {
    color: appTokens.color.vd14f9016,
    fontWeight: appTokens.typography.n600,
    fontSize: appTokens.typography.n13,
  },
});
