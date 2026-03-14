import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type {
  SessionContext,
  SessionSourceType,
  SessionSpeakingFunction,
} from "@shadowoo/shared";
import {
  SOURCE_TYPE_LABELS,
  SPEAKING_FUNCTION_LABELS,
} from "../../lib/professional-labels";

interface ContextBriefCardProps {
  context: SessionContext | null;
  sourceType?: SessionSourceType;
  speakingFunction?: SessionSpeakingFunction;
  premiumRequired?: boolean;
  locked: boolean;
  onUnlock: () => void;
  onStartLearning: () => void;
}

export default function ContextBriefCard({
  context,
  sourceType,
  speakingFunction,
  premiumRequired = false,
  locked,
  onUnlock,
  onStartLearning,
}: ContextBriefCardProps) {
  if (!context && !speakingFunction && !sourceType) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.kicker}>학습 전 브리프</Text>
        {premiumRequired ? (
          <View style={[styles.badge, locked && styles.badgeLocked]}>
            <Text style={[styles.badgeText, locked && styles.badgeTextLocked]}>
              {locked ? "프리미엄" : "열람 가능"}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        {sourceType ? (
          <View style={styles.metaBadge}>
            <Text style={styles.metaText}>
              {SOURCE_TYPE_LABELS[sourceType]}
            </Text>
          </View>
        ) : null}
        {context?.speaking_function || speakingFunction ? (
          <View style={styles.metaBadge}>
            <Text style={styles.metaText}>
              {
                SPEAKING_FUNCTION_LABELS[
                  (context?.speaking_function ||
                    speakingFunction) as SessionSpeakingFunction
                ]
              }
            </Text>
          </View>
        ) : null}
      </View>

      {locked ? (
        <View style={styles.lockedState}>
          <Text style={styles.lockedTitle}>
            이 세션의 프리러닝 브리프는 프리미엄에서 열립니다.
          </Text>
          <Text style={styles.lockedText}>
            세션이 어떤 말하기 상황을 훈련하는지, 왜 이 표현이 좋은지, 어떤 업무
            장면에 재사용할 수 있는지 먼저 확인할 수 있어요.
          </Text>
          <TouchableOpacity
            style={styles.unlockButton}
            onPress={onUnlock}
            activeOpacity={0.8}
          >
            <Text style={styles.unlockButtonText}>브리프 열기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.startButtonSecondary}
            onPress={onStartLearning}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonSecondaryText}>바로 학습 시작</Text>
          </TouchableOpacity>
        </View>
      ) : (
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

          <TouchableOpacity
            style={styles.startButton}
            onPress={onStartLearning}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>학습 시작</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#111111",
    backgroundColor: "#FAFAFA",
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111111",
  },
  badge: {
    borderWidth: 1,
    borderColor: "#111111",
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#FFFFFF",
  },
  badgeLocked: {
    backgroundColor: "#111111",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#111111",
  },
  badgeTextLocked: {
    color: "#FFFFFF",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  metaBadge: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaText: {
    fontSize: 10,
    color: "#666666",
    fontWeight: "600",
  },
  lockedState: {
    gap: 10,
  },
  lockedTitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#111111",
    fontWeight: "700",
  },
  lockedText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#666666",
  },
  unlockButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#111111",
    backgroundColor: "#111111",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  unlockButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  startButtonSecondary: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#111111",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
  },
  startButtonSecondaryText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111111",
  },
  content: {
    gap: 10,
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
  startButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#111111",
    backgroundColor: "#111111",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  startButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
