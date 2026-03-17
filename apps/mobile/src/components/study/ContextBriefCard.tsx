import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { SessionContext, KeyVocabularyEntry } from "@shadowoo/shared";

function normalizeVocabEntry(
  item: string | KeyVocabularyEntry,
): Required<KeyVocabularyEntry> {
  if (typeof item === "string")
    return { expression: item, example: "", translation: "" };
  return {
    expression: item.expression ?? "",
    example: item.example ?? "",
    translation: item.translation ?? "",
  };
}

interface ContextBriefCardProps {
  context: SessionContext | null;
  locked: boolean;
  onUnlock: () => void;
}

export default function ContextBriefCard({
  context,
  locked,
  onUnlock,
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

      {/* Brief content — clipped when locked */}
      <View
        style={[styles.content, locked && hasContent && styles.contentLocked]}
      >
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
            {context.key_vocabulary.map((item, idx) => {
              const entry = normalizeVocabEntry(item);
              return (
                <View key={idx} style={styles.vocabItem}>
                  <Text style={styles.vocabExpression}>{entry.expression}</Text>
                  {entry.example ? (
                    <Text style={styles.vocabExample}>{entry.example}</Text>
                  ) : null}
                  {entry.translation ? (
                    <Text style={styles.vocabTranslation}>
                      {entry.translation}
                    </Text>
                  ) : null}
                </View>
              );
            })}
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
              "rgba(255,255,255,0.15)",
              "rgba(255,255,255,0.4)",
              "rgba(255,255,255,0.7)",
              "rgba(255,255,255,0.9)",
              "#FFFFFF",
            ]}
            locations={[0, 0.15, 0.35, 0.55, 0.75, 1]}
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
  vocabItem: {
    marginBottom: 6,
  },
  vocabExpression: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    color: "#111111",
  },
  vocabExample: {
    fontSize: 12,
    lineHeight: 17,
    color: "#888888",
    marginTop: 1,
  },
  vocabTranslation: {
    fontSize: 12,
    lineHeight: 17,
    color: "#AAAAAA",
    marginTop: 1,
  },
  emptyText: {
    fontSize: 13,
    color: "#888888",
  },

  contentLocked: {
    maxHeight: 110,
    overflow: "hidden",
  },

  // Gradient lock overlay
  gradientWrapper: {
    marginTop: -60,
  },
  gradient: {
    height: 60,
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
});
