import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { buildAssessmentItems } from "@inputenglish/shared";
import type { AssessmentItem } from "@inputenglish/shared";
import { useTheme, createThemedStyles } from "@/components/ui";
import type { VocabAnswer } from "@/lib/premium-api";

// @MX:NOTE: Onboarding Yes/No vocab-size test (SPEC-INPUT-003 REQ-VOCAB-A/I).
// Items are sampled client-side from the shared frequency list; the SERVER is
// authoritative — it re-derives isReal/band from the same list on submit
// (contract C5.4). We only collect { token, known } and never send band/isReal.

const WORDS_PER_BAND = 10; // 4 bands → ~40 real words
const PSEUDOWORD_COUNT = 10; // false-positive correction items
const WORDS_PER_PAGE = 12;

function chunk<T>(arr: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    pages.push(arr.slice(i, i + size));
  }
  return pages;
}

interface VocabAssessmentProps {
  onComplete: (answers: VocabAnswer[]) => void;
  onSkip: () => void;
  submitting?: boolean;
  /** Fixed seed for deterministic item sampling (tests). */
  seed?: number;
}

export function VocabAssessment({
  onComplete,
  onSkip,
  submitting = false,
  seed,
}: VocabAssessmentProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  // Sample once per mount. The server re-validates, so a random seed is safe.
  const seedRef = useRef<number>(
    seed ?? Math.floor(Math.random() * 1_000_000_000),
  );
  const items = useMemo<AssessmentItem[]>(
    () =>
      buildAssessmentItems({
        wordsPerBand: WORDS_PER_BAND,
        pseudowordCount: PSEUDOWORD_COUNT,
        seed: seedRef.current,
      }),
    [],
  );
  const pages = useMemo(() => chunk(items, WORDS_PER_PAGE), [items]);

  const [pageIndex, setPageIndex] = useState(0);
  // token -> known (default: not known). User taps words they recognize.
  const [known, setKnown] = useState<Record<string, boolean>>({});

  const toggle = (token: string) =>
    setKnown((prev) => ({ ...prev, [token]: !prev[token] }));

  const isLastPage = pageIndex === pages.length - 1;
  const progress = (pageIndex + 1) / pages.length;

  const handleNext = () => {
    if (submitting) return;
    if (!isLastPage) {
      setPageIndex((p) => p + 1);
      return;
    }
    const answers: VocabAnswer[] = items.map((item) => ({
      token: item.token,
      known: Boolean(known[item.token]),
    }));
    onComplete(answers);
  };

  const currentPage = pages[pageIndex] ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <Text style={styles.title}>아는 단어를 모두 골라주세요</Text>
      <Text style={styles.subtitle}>
        뜻이 떠오르는 단어만 탭하세요. 모르면 그냥 두면 돼요. 정확한 추천을 위해
        실력을 잰답니다.
      </Text>

      <ScrollView
        style={styles.wordsScroll}
        contentContainerStyle={styles.wordGrid}
        showsVerticalScrollIndicator={false}
      >
        {currentPage.map((item) => {
          const isKnown = Boolean(known[item.token]);
          return (
            <Pressable
              key={item.token}
              accessibilityLabel={`단어 ${item.token}`}
              accessibilityState={{ selected: isKnown }}
              onPress={() => toggle(item.token)}
              style={[styles.wordChip, isKnown && styles.wordChipKnown]}
            >
              <Text style={[styles.wordText, isKnown && styles.wordTextKnown]}>
                {item.token}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityLabel={isLastPage ? "어휘 평가 제출" : "다음 단어 묶음"}
          onPress={handleNext}
          disabled={submitting}
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.text.inverse} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isLastPage ? "결과 확인" : "다음"}
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityLabel="테스트 건너뛰고 직접 선택"
          onPress={onSkip}
          disabled={submitting}
          style={styles.skipButton}
        >
          <Text style={styles.skipText}>건너뛰고 직접 선택할게요</Text>
        </Pressable>
      </View>
    </View>
  );
}

const getStyles = createThemedStyles((theme) => ({
  root: {
    flex: 1,
  },
  progressTrack: {
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface.muted,
    overflow: "hidden" as const,
    marginBottom: theme.spacing[6],
  },
  progressFill: {
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.action.primary,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[2],
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing[4],
  },
  wordsScroll: {
    flex: 1,
  },
  wordGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: theme.spacing[2],
    paddingBottom: theme.spacing[4],
  },
  wordChip: {
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    backgroundColor: theme.colors.surface.muted,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: 10,
  },
  wordChipKnown: {
    borderColor: theme.colors.action.primary,
    backgroundColor: theme.colors.action.primary,
  },
  wordText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text.primary,
  },
  wordTextKnown: {
    color: theme.colors.text.inverse,
  },
  footer: {
    gap: theme.spacing[2],
    paddingTop: theme.spacing[4],
  },
  primaryButton: {
    backgroundColor: theme.colors.action.primary,
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing[4],
    alignItems: "center" as const,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.text.inverse,
  },
  skipButton: {
    alignItems: "center" as const,
    paddingVertical: theme.spacing[2],
  },
  skipText: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
  },
}));
