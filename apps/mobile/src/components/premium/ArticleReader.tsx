import React, { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { ReadingPiece } from "@inputenglish/shared";
import { colors, font, leading, spacing } from "@/theme";

interface ArticleReaderProps {
  piece: ReadingPiece;
  onWordTap?: (lemma: string) => void;
}

// @MX:NOTE: [AUTO] Tokenizes body text into segments for tap-gloss rendering.
// Preserves whitespace tokens so the rendered text matches the original layout.
function tokenizeBody(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean);
}

function toLemma(word: string): string {
  // v1: simple lowercase strip of punctuation
  return word.toLowerCase().replace(/[^a-z]/g, "");
}

// @MX:ANCHOR: [AUTO] ArticleReader with tap-gloss sensor for ReadingPiece.
// @MX:REASON: Extracted from PremiumSessionScreen; onWordTap callback hooks into vocab profile update (Phase 5).
export default function ArticleReader({
  piece,
  onWordTap,
}: ArticleReaderProps) {
  const handleWordTap = useCallback(
    (word: string) => {
      const lemma = toLemma(word);
      if (lemma && onWordTap) {
        onWordTap(lemma);
      }
    },
    [onWordTap],
  );

  const tokens = tokenizeBody(piece.body);

  return (
    <ScrollView
      testID="premium-article-reader"
      contentContainerStyle={styles.panelScroll}
    >
      <Text style={styles.eyebrow}>읽기</Text>
      <Text style={styles.articleTitle}>{piece.topic}</Text>
      <View style={styles.bodyContainer} testID="article-body">
        <Text style={styles.articleBody}>
          {onWordTap
            ? tokens.map((token, index) => {
                const lemma = toLemma(token);
                const isTappable = lemma.length >= 2;
                if (isTappable) {
                  return (
                    <Text
                      key={index}
                      testID={`word-token-${lemma}`}
                      onPress={() => handleWordTap(token)}
                      style={styles.tappableWord}
                    >
                      {token}
                    </Text>
                  );
                }
                return <Text key={index}>{token}</Text>;
              })
            : piece.body}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Level: {piece.level}</Text>
        <Text style={styles.metaText}>Format: {piece.format}</Text>
        {piece.coveragePct !== null ? (
          <Text style={styles.metaText}>Coverage: {piece.coveragePct}%</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  panelScroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  eyebrow: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    letterSpacing: font.tracking.wider,
    color: colors.textPremiumSecondary,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  articleTitle: {
    fontSize: font.size.lg,
    lineHeight: leading(font.size.lg, font.lineHeight.tight),
    fontWeight: font.weight.semibold,
    color: colors.textPremium,
    marginBottom: spacing.sm,
  },
  bodyContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  articleBody: {
    fontSize: font.size.base,
    lineHeight: leading(font.size.base, font.lineHeight.relaxed),
    fontWeight: font.weight.regular,
    color: colors.textPremium,
  },
  tappableWord: {
    fontSize: font.size.base,
    lineHeight: leading(font.size.base, font.lineHeight.relaxed),
    fontWeight: font.weight.regular,
    color: colors.textPremium,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.textPremiumMuted,
  },
  metaText: {
    fontSize: font.size.sm,
    fontWeight: font.weight.regular,
    color: colors.textPremiumSecondary,
  },
});
