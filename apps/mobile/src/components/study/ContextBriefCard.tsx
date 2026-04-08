import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { SessionContext, KeyVocabularyEntry } from "@inputenglish/shared";
import { colors, font, radius } from "../../theme";

function normalizeVocabEntry(
  item: string | KeyVocabularyEntry,
): Required<KeyVocabularyEntry> {
  if (typeof item === "string")
    return {
      expression: item,
      example: "",
      translation: "",
      pronunciation_note: "",
    };
  return {
    expression: item.expression ?? "",
    example: item.example ?? "",
    translation: item.translation ?? "",
    pronunciation_note: item.pronunciation_note ?? "",
  };
}

interface ContextBriefCardProps {
  context: SessionContext | null;
}

export default function ContextBriefCard({ context }: ContextBriefCardProps) {
  const hasContent = Boolean(
    context?.expected_takeaway ||
    context?.key_vocabulary?.length ||
    context?.grammar_rhetoric_note,
  );

  if (!hasContent) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          이 세션에는 브리프가 아직 없습니다.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {context?.expected_takeaway ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>학습 후 기대 효과</Text>
          <Text style={styles.bodyText}>{context.expected_takeaway}</Text>
        </View>
      ) : null}

      {context?.grammar_rhetoric_note ? (
        <View style={styles.tipContainer}>
          <Text style={styles.tipLabel}>TIP</Text>
          <Text style={styles.tipText}>{context.grammar_rhetoric_note}</Text>
        </View>
      ) : null}

      {context?.key_vocabulary?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>핵심 표현</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.vocabScroll}
          >
            {context.key_vocabulary.map((item, idx) => {
              const entry = normalizeVocabEntry(item);
              return (
                <View key={idx} style={styles.vocabCard}>
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
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 28,
    paddingBottom: 8,
    gap: 32,
  },

  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: font.weight.bold,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.textMuted,
    paddingHorizontal: 20,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
    paddingHorizontal: 20,
    fontWeight: font.weight.regular,
  },

  // Vocab horizontal scroll
  vocabScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  vocabCard: {
    width: 270,
    padding: 18,
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  vocabExpression: {
    fontSize: 15,
    fontWeight: font.weight.bold,
    lineHeight: 22,
    color: colors.text,
  },
  vocabExample: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  vocabTranslation: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },

  // Tip
  tipContainer: {
    marginHorizontal: 20,
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.lg,
    padding: 16,
    gap: 6,
  },
  tipLabel: {
    fontSize: 11,
    fontWeight: font.weight.bold,
    letterSpacing: 1.5,
    color: colors.textMuted,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },

  // Empty state
  empty: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
