import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { SessionContext, KeyVocabularyEntry } from "@inputenglish/shared";
import { colors, font, leading, radius, spacing } from "../../theme";

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

export default function ContextBriefCard({
  context,
}: ContextBriefCardProps): React.ReactElement {
  const hasTakeaway = Boolean(context?.expected_takeaway);
  const hasTip = Boolean(context?.grammar_rhetoric_note);
  const hasVocab = Boolean(context?.key_vocabulary?.length);
  const hasContent = hasTakeaway || hasTip || hasVocab;

  if (!hasContent) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEyebrow}>학습 브리프</Text>
        <Text style={styles.emptyText}>이 세션에는 브리프가 아직 없어요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {hasTakeaway ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>학습 후 기대 효과</Text>
          <Text style={styles.takeawayText}>{context?.expected_takeaway}</Text>
        </View>
      ) : null}

      {hasTip ? (
        <>
          {hasTakeaway ? <View style={styles.divider} /> : null}
          <View style={styles.section}>
            <Text style={styles.eyebrow}>학습 포인트</Text>
            <View style={styles.tipRow}>
              <View style={styles.tipAccent} />
              <Text style={styles.tipText}>
                {context?.grammar_rhetoric_note}
              </Text>
            </View>
          </View>
        </>
      ) : null}

      {hasVocab ? (
        <>
          {hasTakeaway || hasTip ? <View style={styles.divider} /> : null}
          <View style={styles.sectionVocab}>
            <View style={styles.vocabHeader}>
              <Text style={styles.eyebrow}>핵심 표현</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.vocabScroll}
            >
              {context?.key_vocabulary?.map((item, idx) => {
                const entry = normalizeVocabEntry(item);
                return (
                  <View key={idx} style={styles.vocabCard}>
                    <Text style={styles.vocabExpression}>
                      {entry.expression}
                    </Text>
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
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  sectionVocab: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  eyebrow: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    letterSpacing: font.tracking.wide,
    color: colors.textMuted,
  },
  vocabHeader: {
    paddingHorizontal: spacing.lg,
  },
  takeawayText: {
    fontSize: font.size.lg,
    lineHeight: leading(font.size.lg, font.lineHeight.relaxed),
    color: colors.text,
    fontWeight: font.weight.regular,
    letterSpacing: font.tracking.semiTight,
  },
  tipRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "stretch",
  },
  tipAccent: {
    width: 3,
    alignSelf: "stretch",
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
  },
  tipText: {
    flex: 1,
    fontSize: font.size.base,
    lineHeight: leading(font.size.base, font.lineHeight.relaxed),
    color: colors.text,
    letterSpacing: font.tracking.normal,
  },
  divider: {
    height: 1,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.border,
  },
  vocabScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  vocabCard: {
    width: 300,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vocabExpression: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    lineHeight: leading(font.size.xl, font.lineHeight.tight),
    color: colors.text,
    letterSpacing: font.tracking.tight,
  },
  vocabExample: {
    fontSize: font.size.md,
    lineHeight: leading(font.size.md, font.lineHeight.relaxed),
    color: colors.textSecondary,
  },
  vocabTranslation: {
    fontSize: font.size.sm,
    lineHeight: leading(font.size.sm, font.lineHeight.relaxed),
    color: colors.textMuted,
  },
  empty: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  emptyEyebrow: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    letterSpacing: font.tracking.wide,
    color: colors.textMuted,
  },
  emptyText: {
    fontSize: font.size.md,
    lineHeight: leading(font.size.md, font.lineHeight.relaxed),
    color: colors.textMuted,
  },
});
