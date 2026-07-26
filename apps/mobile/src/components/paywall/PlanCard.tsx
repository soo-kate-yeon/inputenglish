// @MX:NOTE: [AUTO] Plan display card for paywall screen showing features and CTA.
// FREE vs PREMIUM 2단계 플랜 구조. PREMIUM 카드는 isCurrentPlan 시 강조 테두리.
// @MX:SPEC: SPEC-MOBILE-006

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { appTokens } from "../../theme/app-tokens";

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
    backgroundColor: appTokens.color.vd14f9016,
    borderRadius: appTokens.radius.n16,
    padding: appTokens.spacing.n20,
    marginVertical: appTokens.spacing.n8,
    marginHorizontal: appTokens.spacing.n16,
    borderWidth: 1,
    borderColor: appTokens.color.vd31e0c0a,
    shadowColor: appTokens.color.v598b32b7,
    shadowOffset: { width: 0, height: appTokens.size.n2 },
    shadowOpacity: appTokens.shadow.n0_06,
    shadowRadius: appTokens.shadow.n8,
    elevation: appTokens.shadow.n2,
  },
  currentBadge: {
    alignSelf: "flex-start",
    borderRadius: appTokens.radius.n8,
    paddingHorizontal: appTokens.spacing.n10,
    paddingVertical: appTokens.spacing.n3,
    marginBottom: appTokens.spacing.n10,
  },
  currentBadgeText: {
    color: appTokens.color.vd14f9016,
    fontSize: appTokens.typography.n11,
    fontWeight: appTokens.typography.n700,
  },
  planName: {
    fontSize: appTokens.typography.n22,
    fontWeight: appTokens.typography.n700,
    marginBottom: appTokens.spacing.n14,
  },
  featureList: {
    gap: appTokens.spacing.n6,
    marginBottom: appTokens.spacing.n4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: appTokens.spacing.n6,
  },
  featureBullet: {
    color: appTokens.color.v84423e18,
    fontSize: appTokens.typography.n14,
    lineHeight: appTokens.typography.n20,
  },
  featureText: {
    flex: 1,
    fontSize: appTokens.typography.n14,
    color: appTokens.color.vddbce3da,
    lineHeight: appTokens.typography.n20,
  },
  ctaButton: {
    borderRadius: appTokens.radius.n10,
    paddingVertical: appTokens.spacing.n12,
    alignItems: "center",
    marginTop: appTokens.spacing.n16,
  },
  ctaText: {
    color: appTokens.color.vd14f9016,
    fontWeight: appTokens.typography.n700,
    fontSize: appTokens.typography.n15,
  },
});
