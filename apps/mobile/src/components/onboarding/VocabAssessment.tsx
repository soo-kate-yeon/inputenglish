import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { buildAssessmentItems } from "@inputenglish/shared";
import type { AssessmentItem } from "@inputenglish/shared";
import { useTheme, createThemedStyles } from "@/components/ui";
import type { VocabAnswer } from "@/lib/premium-api";
import { safeSelectionAsync, safeImpactLight } from "@/lib/safeHaptic";

// Green for a selected ("known") word — no green token in the design system yet.
const SELECTED_WORD_COLOR = "#22C55E";
// Scale a word pops to when selected — bouncy spring for a game-like feel.
const SELECTED_SCALE = 1.18;
const IS_TEST_ENV = process.env.NODE_ENV === "test";

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

// A single word. Springs up in scale (and turns green via style) when selected,
// for a tactile, game-like selection.
function WordItem({
  token,
  isKnown,
  onPress,
}: {
  token: string;
  isKnown: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const scale = useRef(
    new Animated.Value(isKnown ? SELECTED_SCALE : 1),
  ).current;

  useEffect(() => {
    if (IS_TEST_ENV) {
      scale.setValue(isKnown ? SELECTED_SCALE : 1);
      return;
    }
    Animated.spring(scale, {
      toValue: isKnown ? SELECTED_SCALE : 1,
      useNativeDriver: true,
      friction: 5,
      tension: 200,
    }).start();
  }, [isKnown, scale]);

  return (
    <Pressable
      accessibilityLabel={`단어 ${token}`}
      accessibilityState={{ selected: isKnown }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.wordCell,
        pressed && styles.wordCellPressed,
      ]}
    >
      <Animated.Text
        style={[
          styles.wordText,
          isKnown && styles.wordTextKnown,
          { transform: [{ scale }] },
        ]}
      >
        {token}
      </Animated.Text>
    </Pressable>
  );
}

interface VocabAssessmentProps {
  onComplete: (answers: VocabAnswer[]) => void;
  /** Called when back is pressed on the first page (exit the test). */
  onBack: () => void;
  submitting?: boolean;
  /** Fixed seed for deterministic item sampling (tests). */
  seed?: number;
}

export function VocabAssessment({
  onComplete,
  onBack,
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

  const toggle = (token: string) => {
    safeSelectionAsync();
    setKnown((prev) => ({ ...prev, [token]: !prev[token] }));
  };

  const isLastPage = pageIndex === pages.length - 1;
  const progress = (pageIndex + 1) / pages.length;

  const handleNext = () => {
    if (submitting) return;
    safeImpactLight();
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

  // Back goes one page within the test; from the first page it exits via onBack.
  const handleBackPress = () => {
    if (submitting) return;
    safeImpactLight();
    if (pageIndex > 0) {
      setPageIndex((p) => p - 1);
      return;
    }
    onBack();
  };

  const currentPage = pages[pageIndex] ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityLabel="이전"
          onPress={handleBackPress}
          disabled={submitting}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={theme.colors.text.primary}
          />
        </Pressable>
      </View>
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
        {currentPage.map((item) => (
          <WordItem
            key={item.token}
            token={item.token}
            isKnown={Boolean(known[item.token])}
            onPress={() => toggle(item.token)}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityLabel="다음"
          onPress={handleNext}
          disabled={submitting}
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.text.inverse} />
          ) : (
            <Text style={styles.primaryButtonText}>다음</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const getStyles = createThemedStyles((theme) => ({
  root: {
    flex: 1,
  },
  headerRow: {
    alignItems: "flex-start" as const,
    marginBottom: theme.spacing[4],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginLeft: -theme.spacing[1],
  },
  backButtonPressed: {
    opacity: 0.7,
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
    justifyContent: "space-between" as const,
    rowGap: theme.spacing[3],
    paddingBottom: theme.spacing[4],
  },
  // Big text-only words in a 2-column layout (no chip box). Selection is shown
  // by green colour + bold + a spring scale-up. Generous vertical padding keeps
  // the tap target large even though only the glyphs are visible.
  wordCell: {
    width: "48%" as const,
    paddingVertical: theme.spacing[3],
    alignItems: "center" as const,
  },
  wordCellPressed: {
    opacity: 0.6,
  },
  wordText: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "500" as const,
    color: theme.colors.text.secondary,
    textAlign: "center" as const,
  },
  // Selected word: green + bold (no underline) per design feedback.
  wordTextKnown: {
    color: SELECTED_WORD_COLOR,
    fontWeight: "700" as const,
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
}));
