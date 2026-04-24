// @MX:NOTE: [AUTO] Main carousel component replacing TransformationPracticePanel (SPEC-MOBILE-011).
// @MX:ANCHOR: [AUTO] Central integration point for transformation practice; consumed by study/[videoId].tsx
// @MX:REASON: High fan_in - used by study screen and tested by multiple test suites
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
} from "react-native";
import { MMKV } from "react-native-mmkv";
import type {
  Sentence,
  TransformationSet,
  TransformationExercise,
} from "@inputenglish/shared";
import {
  fetchTransformationSet,
  getReadableTransformationUploadError,
  saveTransformationAttempt,
  uploadTransformationRecording,
} from "../../lib/transformation-api";
import { supabase } from "../../lib/supabase";
import { CarouselPagination } from "./carousel/CarouselPagination";
import { IntroPage } from "./carousel/IntroPage";
import { KoreanToEnglishPage } from "./carousel/KoreanToEnglishPage";
import { QAResponsePage } from "./carousel/QAResponsePage";
import { DialogCompletionPage } from "./carousel/DialogCompletionPage";
import { SituationResponsePage } from "./carousel/SituationResponsePage";
import { ExpressionPage } from "./carousel/ExpressionPage";
import { colors, spacing } from "../../theme";

const SKIP_INTRO_KEY = "transformation_skip_intro";
const mmkv = new MMKV();
const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface TransformationCarouselProps {
  sessionId: string;
  sentences?: Sentence[];
  tipText?: string | null;
  savedSentenceIds?: Set<string>;
  onSaveSentence?: (sentence: Sentence) => void;
  onStartExercise?: () => void;
  onSeekToSentence?: (sentence: Sentence) => void;
}

function renderExercisePage(
  exercise: TransformationExercise,
  onConfirm: (audioUri: string | null, duration: number) => void,
  onRecordingStateChange: (recording: boolean) => void,
): React.ReactElement | null {
  switch (exercise.exercise_type) {
    case "kr-to-en":
      return (
        <KoreanToEnglishPage
          exercise={exercise}
          onConfirm={onConfirm}
          onRecordingStateChange={onRecordingStateChange}
        />
      );
    case "qa-response":
      return (
        <QAResponsePage
          exercise={exercise}
          onConfirm={onConfirm}
          onRecordingStateChange={onRecordingStateChange}
        />
      );
    case "dialog-completion":
      return (
        <DialogCompletionPage
          exercise={exercise}
          onConfirm={onConfirm}
          onRecordingStateChange={onRecordingStateChange}
        />
      );
    case "situation-response":
      return (
        <SituationResponsePage
          exercise={exercise}
          onConfirm={onConfirm}
          onRecordingStateChange={onRecordingStateChange}
        />
      );
    default:
      return null;
  }
}

export function TransformationCarousel({
  sessionId,
  sentences: allSentences = [],
  tipText,
  savedSentenceIds,
  onSaveSentence,
  onStartExercise,
  onSeekToSentence,
}: TransformationCarouselProps) {
  const [set, setSet] = useState<TransformationSet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Check if intro should be skipped
  const skipIntro = mmkv.getString(SKIP_INTRO_KEY) === "true";

  // Resolve source sentences from the fetched set's source_sentence_ids
  const sourceSentences = useMemo(() => {
    const ids = set?.source_sentence_ids ?? [];
    if (ids.length === 0) return [];
    return ids
      .map((id) => allSentences.find((s) => s.id === id))
      .filter((s): s is Sentence => !!s);
  }, [set?.source_sentence_ids, allSentences]);
  const hasExpression = sourceSentences.length > 0;
  const firstExerciseIndex = hasExpression ? 2 : 1;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchTransformationSet(sessionId)
      .then((data) => {
        if (!cancelled) {
          setSet(data);
        }
      })
      .catch((err) => {
        console.error("[TransformationCarousel] fetch error:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const exercises = useMemo(
    () =>
      [...(set?.exercises ?? [])].sort((a, b) => a.page_order - b.page_order),
    [set?.exercises],
  );

  // Build pages: [IntroPage, ExpressionPage?, ...exercises]
  const pages = useMemo(
    () => [
      { key: "intro", type: "intro" as const },
      ...(hasExpression
        ? [{ key: "expression", type: "expression" as const }]
        : []),
      ...exercises.map((ex) => ({
        key: ex.id,
        type: "exercise" as const,
        exercise: ex,
      })),
    ],
    [exercises, hasExpression],
  );

  // After set loads, skip intro if MMKV flag is set
  useEffect(() => {
    if (!set || isLoading || exercises.length === 0) return;
    if (skipIntro) {
      const target = hasExpression ? 1 : firstExerciseIndex;
      if (target < pages.length) {
        setCurrentIndex(target);
        // Delay scroll to ensure FlatList has rendered
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: target,
            animated: false,
          });
        }, 50);
      }
    }
  }, [
    set,
    isLoading,
    skipIntro,
    hasExpression,
    firstExerciseIndex,
    exercises.length,
    pages.length,
  ]);

  const handleDismissForever = useCallback(() => {
    mmkv.set(SKIP_INTRO_KEY, "true");
    const target = hasExpression ? 1 : firstExerciseIndex;
    flatListRef.current?.scrollToIndex({ index: target, animated: true });
    setCurrentIndex(target);
  }, [hasExpression, firstExerciseIndex]);

  const handleSkip = useCallback(() => {
    const target = hasExpression ? 1 : firstExerciseIndex;
    flatListRef.current?.scrollToIndex({ index: target, animated: true });
    setCurrentIndex(target);
  }, [hasExpression, firstExerciseIndex]);

  const handleExpressionNext = useCallback(() => {
    onStartExercise?.();
    flatListRef.current?.scrollToIndex({
      index: firstExerciseIndex,
      animated: true,
    });
    setCurrentIndex(firstExerciseIndex);
  }, [firstExerciseIndex, onStartExercise]);

  const handleRecordingStateChange = useCallback((recording: boolean) => {
    setIsRecording(recording);
  }, []);

  const handleConfirm = useCallback(
    async (
      exercise: TransformationExercise,
      audioUri: string | null,
      duration: number,
    ) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Upload recording to Supabase Storage first, then save attempt
        let publicUrl: string | undefined;
        if (audioUri) {
          const uploadedUrl = await uploadTransformationRecording(
            audioUri,
            user.id,
            exercise.id,
          );
          publicUrl = uploadedUrl ?? undefined;
        }

        await saveTransformationAttempt({
          user_id: user.id,
          exercise_id: exercise.id,
          recording_url: publicUrl,
          recording_duration: duration > 0 ? duration : undefined,
        });

        // Advance to next page if available
        const exerciseIndex = exercises.findIndex((e) => e.id === exercise.id);
        const nextPageIndex = exerciseIndex + firstExerciseIndex + 1;
        const totalPages = firstExerciseIndex + exercises.length;
        if (nextPageIndex < totalPages) {
          flatListRef.current?.scrollToIndex({
            index: nextPageIndex,
            animated: true,
          });
          setCurrentIndex(nextPageIndex);
        }
      } catch (err) {
        console.error("[TransformationCarousel] handleConfirm error:", err);
        Alert.alert(
          "녹음 업로드에 실패했어요",
          getReadableTransformationUploadError(err),
        );
      }
    },
    [exercises, firstExerciseIndex],
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (!set || exercises.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          변형 연습이 아직 준비되지 않았어요.
        </Text>
      </View>
    );
  }

  const currentPageType = pages[currentIndex]?.type;

  return (
    <View style={styles.container}>
      <CarouselPagination total={pages.length} currentIndex={currentIndex} />
      <FlatList
        ref={flatListRef}
        data={pages}
        horizontal
        pagingEnabled
        scrollEnabled={!isRecording && currentPageType !== "expression"}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        initialScrollIndex={0}
        getItemLayout={(_data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(
            e.nativeEvent.contentOffset.x / SCREEN_WIDTH,
          );
          setCurrentIndex(newIndex);
        }}
        renderItem={({ item }) => {
          if (item.type === "intro") {
            return (
              <View style={styles.page}>
                <IntroPage
                  onSkip={handleSkip}
                  onDismissForever={handleDismissForever}
                />
              </View>
            );
          }

          if (item.type === "expression" && sourceSentences.length > 0) {
            return (
              <View style={styles.page}>
                <ExpressionPage
                  sentences={sourceSentences}
                  tipText={tipText}
                  savedSentenceIds={savedSentenceIds}
                  onSave={onSaveSentence}
                  onNext={handleExpressionNext}
                  onSeekToSentence={onSeekToSentence}
                />
              </View>
            );
          }

          const exercise = item.exercise;
          return (
            <View style={styles.page}>
              {renderExercisePage(
                exercise,
                (audioUri, duration) =>
                  handleConfirm(exercise, audioUri, duration),
                handleRecordingStateChange,
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: "center",
  },
});
