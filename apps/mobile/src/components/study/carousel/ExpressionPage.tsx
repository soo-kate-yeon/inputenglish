import React, { useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Sentence } from "@inputenglish/shared";
import { colors, font, radius, spacing } from "../../../theme";

interface ExpressionPageProps {
  sentences: Sentence[];
  onPlay: (sentence: Sentence) => void;
  onNext: () => void;
}

export function ExpressionPage({
  sentences,
  onPlay,
  onNext,
}: ExpressionPageProps) {
  const handlePlay = useCallback(
    (sentence: Sentence) => {
      onPlay(sentence);
    },
    [onPlay],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>EXPRESSION PREVIEW</Text>
        <Text style={styles.title}>배워볼 표현</Text>
        <Text style={styles.subtitle}>
          연습을 시작하기 전에, 핵심 표현의 발음과 뉘앙스를 먼저 들어보세요.
          {"\n"}문장을 탭하면 원본 발음을 들을 수 있어요.
        </Text>

        {/* Reuses ScriptLine active style: tap to play original audio */}
        {sentences.map((sentence) => (
          <TouchableOpacity
            key={sentence.id}
            style={styles.scriptRow}
            onPress={() => handlePlay(sentence)}
            activeOpacity={0.85}
          >
            <View style={styles.scriptContent}>
              <Text style={styles.scriptText}>{sentence.text}</Text>
              {sentence.translation ? (
                <Text style={styles.scriptTranslation}>
                  {sentence.translation}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
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
  label: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    letterSpacing: 2.5,
    color: colors.textSecondary,
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
  // Mirrors ScriptLine active style
  scriptRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  scriptContent: {
    flex: 1,
    gap: 6,
  },
  scriptText: {
    color: colors.text,
    fontWeight: font.weight.bold,
    fontSize: font.size.lg,
    lineHeight: 30,
  },
  scriptTranslation: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
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
