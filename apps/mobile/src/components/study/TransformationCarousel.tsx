// @MX:NOTE: [AUTO] Main carousel component replacing TransformationPracticePanel (SPEC-MOBILE-011).
// @MX:ANCHOR: [AUTO] Central integration point for transformation practice; consumed by study/[videoId].tsx
// @MX:REASON: High fan_in - used by study screen and tested by multiple test suites
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
} from "react-native";
import { MMKV } from "react-native-mmkv";
import type {
  TransformationSet,
  TransformationExercise,
} from "@inputenglish/shared";
import {
  fetchTransformationSet,
  saveTransformationAttempt,
  uploadTransformationRecording,
} from "../../lib/transformation-api";
import { supabase } from "../../lib/supabase";
import { CarouselPagination } from "./carousel/CarouselPagination";
import { IntroPage } from "./carousel/IntroPage";
import { KoreanToEnglishPage } from "./carousel/KoreanToEnglishPage";
import { QAResponsePage } from "./carousel/QAResponsePage";
import { DialogCompletionPage } from "./carousel/DialogCompletionPage";
import { colors, spacing } from "../../theme";

const SKIP_INTRO_KEY = "transformation_skip_intro";
const mmkv = new MMKV();
const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface TransformationCarouselProps {
  sessionId: string;
}

function renderExercisePage(
  exercise: TransformationExercise,
  onConfirm: (audioUri: string | null, duration: number) => void,
): React.ReactElement | null {
  switch (exercise.exercise_type) {
    case "kr-to-en":
      return <KoreanToEnglishPage exercise={exercise} onConfirm={onConfirm} />;
    case "qa-response":
      return <QAResponsePage exercise={exercise} onConfirm={onConfirm} />;
    case "dialog-completion":
      return <DialogCompletionPage exercise={exercise} onConfirm={onConfirm} />;
    default:
      return null;
  }
}

export function TransformationCarousel({
  sessionId,
}: TransformationCarouselProps) {
  const [set, setSet] = useState<TransformationSet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Check if intro should be skipped
  const skipIntro = mmkv.getString(SKIP_INTRO_KEY) === "true";

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchTransformationSet(sessionId).then((data) => {
      if (!cancelled) {
        setSet(data);
        setIsLoading(false);
        // Skip to first exercise if MMKV key set
        if (skipIntro && data?.exercises && data.exercises.length > 0) {
          setCurrentIndex(1);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, skipIntro]);

  const handleDismissForever = useCallback(() => {
    mmkv.set(SKIP_INTRO_KEY, "true");
    // Scroll to first exercise
    flatListRef.current?.scrollToIndex({ index: 1, animated: true });
    setCurrentIndex(1);
  }, []);

  const handleSkip = useCallback(() => {
    flatListRef.current?.scrollToIndex({ index: 1, animated: true });
    setCurrentIndex(1);
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
          publicUrl = await uploadTransformationRecording(
            audioUri,
            user.id,
            exercise.id,
          );
        }

        await saveTransformationAttempt({
          user_id: user.id,
          exercise_id: exercise.id,
          recording_url: publicUrl,
          recording_duration: duration > 0 ? duration : undefined,
        });

        // Advance to next page if available
        const exercises = set?.exercises ?? [];
        const exerciseIndex = exercises.findIndex((e) => e.id === exercise.id);
        const nextPageIndex = exerciseIndex + 2; // +1 for intro page offset
        const totalPages = 1 + exercises.length; // intro + exercise pages
        if (nextPageIndex < totalPages) {
          flatListRef.current?.scrollToIndex({
            index: nextPageIndex,
            animated: true,
          });
          setCurrentIndex(nextPageIndex);
        }
      } catch (err) {
        console.error("[TransformationCarousel] handleConfirm error:", err);
      }
    },
    [set],
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (!set || !set.exercises || set.exercises.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          변형 연습이 아직 준비되지 않았어요.
        </Text>
      </View>
    );
  }

  const exercises = set.exercises.sort((a, b) => a.page_order - b.page_order);

  // Build pages: [IntroPage, ...exercises]
  const pages = [
    { key: "intro", type: "intro" as const },
    ...exercises.map((ex) => ({
      key: ex.id,
      type: "exercise" as const,
      exercise: ex,
    })),
  ];

  return (
    <View style={styles.container}>
      <CarouselPagination total={pages.length} currentIndex={currentIndex} />
      <FlatList
        ref={flatListRef}
        data={pages}
        horizontal
        pagingEnabled
        scrollEnabled={!isRecording}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        initialScrollIndex={skipIntro ? 1 : 0}
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

          const exercise = item.exercise;
          return (
            <View style={styles.page}>
              {renderExercisePage(exercise, (audioUri, duration) =>
                handleConfirm(exercise, audioUri, duration),
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
