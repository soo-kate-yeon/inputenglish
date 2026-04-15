import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Sentence } from "@inputenglish/shared";
import SaveToggle from "../../listening/SaveToggle";
import { colors, font, palette, radius, spacing } from "../../../theme";

interface ExpressionPageProps {
  sentences: Sentence[];
  tipText?: string | null;
  savedSentenceIds?: Set<string>;
  onSave?: (sentence: Sentence) => void;
  onNext: () => void;
}

export function ExpressionPage({
  sentences,
  tipText,
  savedSentenceIds,
  onSave,
  onNext,
}: ExpressionPageProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>배워볼 표현</Text>
        <Text style={styles.subtitle}>
          연습을 시작하기 전에, 핵심 표현의 의미와 구조를 먼저 익혀보세요.
          {"\n"}이제부터는 영상과 분리된 연습 모드로 진행돼요.
        </Text>

        {tipText ? (
          <View style={styles.tipContainer}>
            <Text style={styles.tipLabel}>TIP</Text>
            <Text style={styles.tipText}>{tipText}</Text>
          </View>
        ) : null}

        {sentences.map((sentence) => (
          <View key={sentence.id} style={styles.cardShadow}>
            <View style={styles.card}>
              <View>
                <Text style={styles.sentenceText}>{sentence.text}</Text>
                {sentence.translation ? (
                  <Text style={styles.translation}>{sentence.translation}</Text>
                ) : null}
              </View>
              {onSave && (
                <View style={styles.cardActions}>
                  <SaveToggle
                    active={savedSentenceIds?.has(sentence.id) ?? false}
                    onPress={() => onSave(sentence)}
                  />
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={onNext}
          activeOpacity={0.7}
        >
          <Text style={styles.nextText}>연습 시작하기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.7,
    color: colors.textSecondary,
  },
  tipContainer: {
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  tipLabel: {
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: 1.5,
    color: colors.textMuted,
  },
  tipText: {
    fontSize: font.size.sm,
    lineHeight: 22,
    color: colors.text,
  },
  cardShadow: {
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sentenceText: {
    fontSize: font.size.base,
    lineHeight: font.size.base * 1.55,
    color: colors.text,
    fontWeight: font.weight.regular,
  },
  translation: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  nextBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: "center",
  },
  nextText: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
});
