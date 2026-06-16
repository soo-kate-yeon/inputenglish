import React, { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  extractSentenceContext,
  type ReadingPiece,
} from "@inputenglish/shared";
import { createThemedStyles, useTheme } from "@framingui/react-native";

interface ArticleReaderProps {
  piece: ReadingPiece;
  onWordTap?: (lemma: string, context?: string) => void;
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
  const styles = getStyles(useTheme());

  const tokens = tokenizeBody(piece.body);

  const handleWordTap = useCallback(
    (word: string, tokenIndex: number) => {
      const lemma = toLemma(word);
      if (!lemma || !onWordTap) return;
      // Char offset of the tapped token in the body — locates the exact sentence
      // even when the same word appears multiple times.
      const charOffset = tokens
        .slice(0, tokenIndex)
        .reduce((sum, token) => sum + token.length, 0);
      onWordTap(lemma, extractSentenceContext(piece.body, charOffset));
    },
    [onWordTap, tokens, piece.body],
  );

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
                      onPress={() => handleWordTap(token, index)}
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

const getStyles = createThemedStyles((theme) => ({
  panelScroll: {
    padding: theme.spacing[6],
    gap: theme.spacing[4],
  },
  eyebrow: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: theme.spacing[1],
  },
  articleTitle: {
    ...theme.typography.title,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[2],
  },
  bodyContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  articleBody: {
    ...theme.typography.body,
    color: theme.colors.text.primary,
  },
  tappableWord: {
    ...theme.typography.body,
    color: theme.colors.text.primary,
  },
  metaRow: {
    flexDirection: "row",
    gap: theme.spacing[4],
    marginTop: theme.spacing[2],
    paddingTop: theme.spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.default,
  },
  metaText: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
  },
}));
