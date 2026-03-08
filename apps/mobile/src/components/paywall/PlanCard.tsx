// @MX:NOTE: [AUTO] Plan display card for paywall screen showing features and CTA.
// FREE vs PREMIUM 2단계 플랜 구조. PREMIUM 카드는 isCurrentPlan 시 강조 테두리.
// @MX:SPEC: SPEC-MOBILE-006

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Plan = "FREE" | "PREMIUM";

interface PlanCardProps {
  plan: Plan;
  features: string[];
  isCurrentPlan?: boolean;
  onSelect?: () => void;
}

const PLAN_LABELS: Record<Plan, string> = {
  FREE: "Free",
  PREMIUM: "Premium",
};

const PLAN_COLORS: Record<Plan, string> = {
  FREE: "#8E8E93",
  PREMIUM: "#007AFF",
};

export default function PlanCard({
  plan,
  features,
  isCurrentPlan = false,
  onSelect,
}: PlanCardProps) {
  const accentColor = PLAN_COLORS[plan];

  return (
    <View
      style={[
        styles.card,
        isCurrentPlan && { borderColor: accentColor, borderWidth: 2.5 },
      ]}
    >
      {isCurrentPlan ? (
        <View style={[styles.currentBadge, { backgroundColor: accentColor }]}>
          <Text style={styles.currentBadgeText}>현재 플랜</Text>
        </View>
      ) : null}

      <Text style={[styles.planName, { color: accentColor }]}>
        {PLAN_LABELS[plan]}
      </Text>

      <View style={styles.featureList}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {onSelect ? (
        <TouchableOpacity
          style={[styles.ctaButton, { backgroundColor: accentColor }]}
          onPress={onSelect}
          accessibilityRole="button"
          accessibilityLabel={`${PLAN_LABELS[plan]} 플랜 선택`}
        >
          <Text style={styles.ctaText}>
            {isCurrentPlan ? "현재 플랜" : "선택하기"}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  currentBadge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 10,
  },
  currentBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  planName: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 14,
  },
  featureList: {
    gap: 6,
    marginBottom: 4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  featureBullet: {
    color: "#8E8E93",
    fontSize: 14,
    lineHeight: 20,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: "#3C3C43",
    lineHeight: 20,
  },
  ctaButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
