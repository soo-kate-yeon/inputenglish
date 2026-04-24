import React, { useCallback } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Sentence } from "@inputenglish/shared";
import { colors, font, leading, radius, spacing } from "../../../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - spacing.lg * 3;
const SNAP_INTERVAL = CARD_WIDTH + spacing.md;

interface ExpressionPageProps {
  sentences: Sentence[];
  tipText?: string | null;
  savedSentenceIds?: Set<string>;
  onSave?: (sentence: Sentence) => void;
  onNext: () => void;
  onSeekToSentence?: (sentence: Sentence) => void;
}

export function ExpressionPage({
  sentences,
  tipText,
  onNext,
  onSeekToSentence,
}: ExpressionPageProps) {
  const hasTip = Boolean(tipText);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const rawIndex = Math.round(offsetX / SNAP_INTERVAL);
      // tip card occupies index 0 when present; sentences start after it
      const sentenceIndex = hasTip ? rawIndex - 1 : rawIndex;
      if (sentenceIndex >= 0 && sentenceIndex < sentences.length) {
        onSeekToSentence?.(sentences[sentenceIndex]);
      }
    },
    [hasTip, sentences, onSeekToSentence],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SNAP_INTERVAL}
        contentContainerStyle={styles.carouselContent}
        style={styles.carousel}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {tipText ? (
          <View style={styles.tipCard}>
            <Text style={styles.eyebrow}>TIP</Text>
            <Text style={styles.tipText}>{tipText}</Text>
          </View>
        ) : null}

        {sentences.map((sentence) => (
          <Pressable
            key={sentence.id}
            style={({ pressed }) => [
              styles.sentenceCard,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => onSeekToSentence?.(sentence)}
          >
            <Text style={styles.eyebrow}>PLAY</Text>
            <Text style={styles.sentenceText}>{sentence.text}</Text>
            {sentence.translation ? (
              <Text style={styles.translationText}>
                {"// "}
                {sentence.translation}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.nextBtn,
            pressed && { opacity: 0.85 },
          ]}
          onPress={onNext}
        >
          <Text style={styles.nextText}>연습 시작하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  carousel: {
    flex: 1,
  },
  carouselContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignItems: "flex-start",
    paddingBottom: spacing.md,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: font.weight.bold,
    letterSpacing: 1.5,
    color: colors.textMuted,
  },
  tipCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  tipText: {
    fontSize: font.size.base,
    lineHeight: leading(font.size.base, font.lineHeight.relaxed),
    color: colors.text,
    letterSpacing: font.tracking.normal,
    fontWeight: font.weight.regular,
  },
  sentenceCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sentenceText: {
    fontSize: font.size.lg,
    lineHeight: leading(font.size.lg, font.lineHeight.relaxed),
    color: colors.text,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.normal,
  },
  translationText: {
    fontSize: font.size.sm,
    lineHeight: leading(font.size.sm, font.lineHeight.relaxed),
    color: colors.textMuted,
    letterSpacing: font.tracking.normal,
    fontWeight: font.weight.regular,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nextBtn: {
    backgroundColor: colors.bgInverse,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  nextText: {
    fontSize: font.size.base,
    fontWeight: font.weight.semibold,
    color: colors.textInverse,
    letterSpacing: font.tracking.normal,
  },
});
