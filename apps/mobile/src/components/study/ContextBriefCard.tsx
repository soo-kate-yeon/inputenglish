import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { SessionContext } from "@shadowoo/shared";

interface ContextBriefCardProps {
  context: SessionContext | null;
  locked: boolean;
  ctaLabel: string;
  onUnlock: () => void;
  onStartLearning: () => void;
}

export default function ContextBriefCard({
  context,
  locked,
  ctaLabel,
  onUnlock,
  onStartLearning,
}: ContextBriefCardProps) {
  const hasContent = Boolean(
    context?.strategic_intent ||
    context?.expected_takeaway ||
    context?.key_vocabulary?.length ||
    context?.reusable_scenarios?.length,
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>학습 전 브리프</Text>
      </View>

      {/* Brief content */}
      <View style={styles.content}>
        {context?.strategic_intent ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>이 세션이 길러주는 말하기</Text>
            <Text style={styles.bodyText}>{context.strategic_intent}</Text>
          </View>
        ) : null}

        {context?.expected_takeaway ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>학습 후 기대 효과</Text>
            <Text style={styles.bodyText}>{context.expected_takeaway}</Text>
          </View>
        ) : null}

        {context?.key_vocabulary?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>핵심 표현</Text>
            <Text style={styles.bodyText}>
              {context.key_vocabulary.join(", ")}
            </Text>
          </View>
        ) : null}

        {context?.reusable_scenarios?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>다시 써먹을 수 있는 상황</Text>
            {context.reusable_scenarios.map((scenario) => (
              <Text key={scenario} style={styles.listText}>
                • {scenario}
              </Text>
            ))}
          </View>
        ) : null}

        {!hasContent ? (
          <Text style={styles.emptyText}>
            이 세션에는 브리프가 아직 없습니다.
          </Text>
        ) : null}
      </View>

      {/* Gradient dimming for free users */}
      {locked && hasContent ? (
        <View style={styles.gradientWrapper}>
          <LinearGradient
            colors={[
              "rgba(255,255,255,0)",
              "rgba(255,255,255,0.95)",
              "#FFFFFF",
            ]}
            locations={[0, 0.5, 1]}
            style={styles.gradient}
          />
          <View style={styles.lockCta}>
            <Text style={styles.lockText}>
              전체 브리프는 프리미엄에서 확인할 수 있어요
            </Text>
            <TouchableOpacity
              style={styles.unlockButton}
              onPress={onUnlock}
              activeOpacity={0.8}
            >
              <Text style={styles.unlockButtonText}>프리미엄 시작</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Start / Continue CTA */}
      <TouchableOpacity
        style={styles.startButton}
        onPress={onStartLearning}
        activeOpacity={0.8}
      >
        <Text style={styles.startButtonText}>{ctaLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111111",
    letterSpacing: 1,
  },
  content: {
    gap: 12,
  },
  section: {
    gap: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#888888",
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#111111",
  },
  listText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#111111",
  },
  emptyText: {
    fontSize: 13,
    color: "#888888",
  },

  // Gradient lock overlay
  gradientWrapper: {
    marginTop: -80,
    paddingTop: 0,
  },
  gradient: {
    height: 80,
  },
  lockCta: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  lockText: {
    fontSize: 12,
    color: "#888888",
    textAlign: "center",
  },
  unlockButton: {
    borderWidth: 1,
    borderColor: "#111111",
    backgroundColor: "#111111",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  unlockButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 1,
  },

  // Start CTA
  startButton: {
    borderWidth: 1,
    borderColor: "#111111",
    backgroundColor: "#111111",
    paddingVertical: 14,
    alignItems: "center",
  },
  startButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 1.5,
  },
});
