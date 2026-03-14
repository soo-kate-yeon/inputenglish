import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type {
  SessionContext,
  SessionSourceType,
  SessionSpeakingFunction,
} from "@shadowoo/shared";

const SOURCE_LABELS: Record<string, string> = {
  keynote: "KEYNOTE",
  demo: "DEMO",
  "earnings-call": "EARNINGS",
  podcast: "PODCAST",
  interview: "INTERVIEW",
  panel: "PANEL",
};

const FUNCTION_LABELS: Record<string, string> = {
  persuade: "PERSUADE",
  "explain-metric": "EXPLAIN METRIC",
  summarize: "SUMMARIZE",
  hedge: "HEDGE",
  disagree: "DISAGREE",
  propose: "PROPOSE",
  "answer-question": "Q&A",
};

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
        <Text style={styles.kicker}>PRE-LEARNING BRIEF</Text>
        {premiumRequired ? (
          <View style={[styles.badge, locked && styles.badgeLocked]}>
            <Text style={styles.badgeText}>
              {locked ? "PREMIUM" : "UNLOCKED"}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        {sourceType ? (
          <View style={styles.metaBadge}>
            <Text style={styles.metaText}>{SOURCE_LABELS[sourceType]}</Text>
          </View>
        ) : null}
        {context?.speaking_function || speakingFunction ? (
          <View style={styles.metaBadge}>
            <Text style={styles.metaText}>
              {
                FUNCTION_LABELS[
                  (context?.speaking_function || speakingFunction) as string
                ]
              }
            </Text>
          </View>
        ) : null}
      </View>

      {locked ? (
        <View style={styles.lockedState}>
          <Text style={styles.lockedTitle}>
            이 세션의 프리러닝 브리프는 Premium에서 열립니다.
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
            <Text style={styles.unlockButtonText}>UNLOCK BRIEF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.startButtonSecondary}
            onPress={onStartLearning}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonSecondaryText}>
              CONTINUE TO STUDY
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          {context?.strategic_intent ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>STRATEGIC INTENT</Text>
              <Text style={styles.bodyText}>{context.strategic_intent}</Text>
            </View>
          ) : null}

          {context?.expected_takeaway ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>EXPECTED TAKEAWAY</Text>
              <Text style={styles.bodyText}>{context.expected_takeaway}</Text>
            </View>
          ) : null}

          {context?.key_vocabulary?.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>KEY VOCABULARY</Text>
              <Text style={styles.bodyText}>
                {context.key_vocabulary.join(", ")}
              </Text>
            </View>
          ) : null}

          {context?.reusable_scenarios?.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>REUSABLE SCENARIOS</Text>
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
            <Text style={styles.startButtonText}>START LEARNING</Text>
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
    fontSize: 10,
    letterSpacing: 2,
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
    letterSpacing: 1.2,
    fontWeight: "700",
    color: "#111111",
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
    letterSpacing: 1.2,
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
    fontSize: 10,
    letterSpacing: 1.4,
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
    fontSize: 10,
    letterSpacing: 1.2,
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
    fontSize: 10,
    letterSpacing: 1.4,
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
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
