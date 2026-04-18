import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCuratedVideo } from "@/lib/api";
import { DailyInputQueueItem, getDailyInputQueue } from "@/lib/daily-input";
import { trackEvent } from "@/lib/analytics";
import YouTubePlayer, {
  YouTubePlayerHandle,
} from "@/components/player/YouTubePlayer";
import useAudioRecorder from "@/hooks/useAudioRecorder";
import type {
  CuratedVideo,
  TransformationExercise,
} from "@inputenglish/shared";
import { colors, font, radius, spacing } from "@/theme";

const SWIPE_THRESHOLD = 32;
const SWIPE_VELOCITY_THRESHOLD = 0.22;
const SWIPE_EXIT_DISTANCE = 280;
const CARD_PREVIEW_OFFSET = 28;
const EXERCISE_SWIPE_THRESHOLD = 36;
const EXERCISE_SWIPE_VELOCITY_THRESHOLD = 0.18;
const EXERCISE_EXIT_DISTANCE = 84;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getExerciseInstruction(exercise: TransformationExercise): string {
  switch (exercise.exercise_type) {
    case "kr-to-en":
      return "위에서 배운 표현을 사용해 아래 한국어 문장을 영어로 바꿔보세요.";
    case "qa-response":
      return "위에서 배운 표현을 사용해 아래 질문에 영어로 답해보세요.";
    case "dialog-completion":
      return "위에서 배운 표현을 사용해 아래 대화를 자연스럽게 이어 말해보세요.";
    case "situation-response":
      return "위에서 배운 표현을 사용해 아래 상황에서 바로 꺼낼 한 문장을 말해보세요.";
    default:
      return "위에서 배운 표현을 사용해 아래 문장을 소리 내어 연습해보세요.";
  }
}

function getExercisePrompt(exercise: TransformationExercise): string {
  if (exercise.source_korean) return exercise.source_korean;
  if (exercise.question_text) return exercise.question_text;
  if (exercise.situation_text) return exercise.situation_text;

  if (exercise.dialog_lines && exercise.dialog_lines.length > 0) {
    return exercise.dialog_lines
      .map(
        (line) =>
          `${line.speaker}: ${line.is_blank ? line.text || "여기에 어울리는 답을 말해보세요." : line.text}`,
      )
      .join("\n\n");
  }

  return exercise.instruction_text;
}

function getExpressionIntroCopy(
  targetPattern?: string | null,
  rationale?: string | null,
): { headline: string | null; body: string | null } {
  return {
    headline: targetPattern?.trim() || null,
    body: rationale?.trim() || null,
  };
}

function getPronunciationFocusTags(focusTags: string[]): string[] {
  if (focusTags.length > 0) {
    return focusTags.slice(0, 2);
  }

  return ["속도", "문장 끝 처리"];
}

function DailyQueueCard({
  mediaContent,
  onSentencePress,
  translationContent,
  actionContent,
}: {
  mediaContent: React.ReactNode;
  onSentencePress: () => void;
  translationContent: React.ReactNode;
  actionContent: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.mediaBlock}>{mediaContent}</View>

      <View style={styles.sentenceBlock}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="학습 문장 재생"
          style={styles.sentenceButton}
          onPress={onSentencePress}
        >
          {translationContent}
        </Pressable>
      </View>

      <View style={styles.actionGroup}>{actionContent}</View>
    </View>
  );
}

function ActionIconButton({
  accessibilityLabel,
  iconName,
  isActive = false,
  label,
  onPress,
  variant = "secondary",
}: {
  accessibilityLabel: string;
  iconName: React.ComponentProps<typeof Ionicons>["name"];
  isActive?: boolean;
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";

  return (
    <View style={styles.actionButtonItem}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.actionIconButton,
          isPrimary && styles.actionIconButtonPrimary,
          isActive && styles.actionIconButtonActive,
        ]}
        onPress={onPress}
      >
        <Ionicons
          name={iconName}
          size={20}
          color={isPrimary || isActive ? colors.bg : colors.textMuted}
        />
      </Pressable>
      <Text
        style={[
          styles.actionIconLabel,
          isPrimary && styles.actionIconLabelPrimary,
          isActive && styles.actionIconLabelActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const { learningProfile, isProfileLoading } = useAuth();
  const [queue, setQueue] = useState<DailyInputQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [translationMap, setTranslationMap] = useState<Record<string, boolean>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<CuratedVideo | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRepeatEnabled, setIsRepeatEnabled] = useState(false);
  const [playerNonce, setPlayerNonce] = useState(0);
  const [playerStartSeconds, setPlayerStartSeconds] = useState<number | null>(
    null,
  );
  const trackedImpressionsRef = useRef<Set<string>>(new Set());
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentenceStartSecondsRef = useRef<number | null>(null);
  const sentenceDurationMsRef = useRef<number | null>(null);
  const repeatEnabledRef = useRef(false);
  const panX = useRef(new Animated.Value(0)).current;
  const exercisePanX = useRef(new Animated.Value(0)).current;

  const {
    recordingState,
    audioUri,
    duration,
    startRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder();
  const {
    recordingState: followupRecordingState,
    audioUri: followupAudioUri,
    duration: followupDuration,
    isPlaying: isFollowupPlaying,
    startRecording: startFollowupRecording,
    stopRecording: stopFollowupRecording,
    playRecording: playFollowupRecording,
    pauseRecording: pauseFollowupRecording,
    resetRecording: resetFollowupRecording,
  } = useAudioRecorder();

  const currentItem = queue[activeIndex] ?? null;
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [revealedSampleAnswerIds, setRevealedSampleAnswerIds] = useState<
    Record<string, boolean>
  >({});
  const translationKey = currentItem
    ? `${currentItem.sessionId}:${currentItem.sentenceId}`
    : null;
  const isTranslationVisible = translationKey
    ? Boolean(translationMap[translationKey])
    : false;

  const moveToIndex = useCallback(
    (nextIndex: number) => {
      if (
        nextIndex < 0 ||
        nextIndex >= queue.length ||
        nextIndex === activeIndex
      ) {
        return;
      }

      trackEvent("daily_input_swipe", {
        fromIndex: activeIndex,
        toIndex: nextIndex,
        sessionId: queue[nextIndex].sessionId,
        sentenceId: queue[nextIndex].sentenceId,
      });

      setActiveIndex(nextIndex);
    },
    [activeIndex, queue],
  );

  const previousItem =
    activeIndex > 0 ? (queue[activeIndex - 1] ?? null) : null;
  const nextItem = queue[activeIndex + 1] ?? null;
  const transformationSet = currentItem?.transformationSet ?? null;
  const expressionExercises = useMemo(
    () =>
      [...(transformationSet?.exercises ?? [])].sort(
        (a, b) => a.page_order - b.page_order,
      ),
    [transformationSet],
  );
  const primaryExercise = useMemo(
    () => expressionExercises[exerciseIndex] ?? null,
    [exerciseIndex, expressionExercises],
  );
  const expressionIntroCopy = useMemo(() => {
    if (!transformationSet) {
      return { headline: null, body: null };
    }

    return getExpressionIntroCopy(
      transformationSet.target_pattern,
      transformationSet.pattern_rationale ??
        "이 패턴은 비슷한 상황에서 바로 꺼내 쓸수록 내 표현으로 굳어져요.",
    );
  }, [transformationSet]);
  const canRevealSampleAnswer = Boolean(
    followupAudioUri && primaryExercise?.reference_answer,
  );
  const isCurrentSampleAnswerRevealed = Boolean(
    primaryExercise && revealedSampleAnswerIds[primaryExercise.id],
  );

  const stopPlaybackTimer = useCallback(() => {
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
  }, []);

  const stopSentencePlayback = useCallback(() => {
    stopPlaybackTimer();
    setIsPlaying(false);
    setIsPlayerVisible(false);
    setPlayerNonce((value) => value + 1);
  }, [stopPlaybackTimer]);

  const resetCardPosition = useCallback(() => {
    Animated.spring(panX, {
      toValue: 0,
      tension: 70,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [panX]);

  const animateToIndex = useCallback(
    (direction: "next" | "previous") => {
      const targetIndex =
        direction === "next" ? activeIndex + 1 : activeIndex - 1;
      const targetItem = queue[targetIndex];

      if (!targetItem) {
        resetCardPosition();
        return;
      }

      Animated.timing(panX, {
        toValue:
          direction === "next" ? SWIPE_EXIT_DISTANCE : -SWIPE_EXIT_DISTANCE,
        duration: 190,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        panX.setValue(0);
        moveToIndex(targetIndex);
      });
    },
    [activeIndex, moveToIndex, panX, queue, resetCardPosition],
  );

  const handleSwipeRelease = useCallback(
    (dx: number, vx: number) => {
      if (dx >= SWIPE_THRESHOLD || vx >= SWIPE_VELOCITY_THRESHOLD) {
        animateToIndex("next");
        return;
      }

      if (dx <= -SWIPE_THRESHOLD || vx <= -SWIPE_VELOCITY_THRESHOLD) {
        animateToIndex("previous");
        return;
      }

      resetCardPosition();
    },
    [animateToIndex, resetCardPosition],
  );

  const scheduleSentencePlaybackStop = useCallback(() => {
    const durationMs = sentenceDurationMsRef.current;
    if (durationMs === null) return;

    stopPlaybackTimer();
    playbackTimeoutRef.current = setTimeout(function onSentenceBoundary() {
      if (
        repeatEnabledRef.current &&
        sentenceStartSecondsRef.current !== null
      ) {
        playerRef.current?.seekTo(sentenceStartSecondsRef.current, true);
        playbackTimeoutRef.current = setTimeout(onSentenceBoundary, durationMs);
        return;
      }

      stopSentencePlayback();
    }, durationMs);
  }, [stopPlaybackTimer, stopSentencePlayback]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 3 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          panX.setValue(gestureState.dx);
        },
        onPanResponderRelease: (_, gestureState) =>
          handleSwipeRelease(gestureState.dx, gestureState.vx),
        onPanResponderTerminate: resetCardPosition,
      }),
    [handleSwipeRelease, panX, resetCardPosition],
  );

  const loadQueue = useCallback(async () => {
    if (!learningProfile?.goal_mode) {
      setQueue([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextQueue = await getDailyInputQueue(learningProfile);
      setQueue(nextQueue);
      setActiveIndex(0);
    } catch (loadError) {
      console.error("[DailyInputHome] Failed to load queue:", loadError);
      setError("오늘 학습 카드를 불러오지 못했어요.");
    } finally {
      setIsLoading(false);
    }
  }, [learningProfile]);

  useFocusEffect(
    useCallback(() => {
      void loadQueue();
    }, [loadQueue]),
  );

  useEffect(() => {
    if (!currentItem) {
      setActiveVideo(null);
      setIsPlayerVisible(false);
      setIsPlaying(false);
      return;
    }

    setIsVideoLoading(true);
    setIsPlayerVisible(false);
    setIsPlaying(false);
    setIsRepeatEnabled(false);
    setPlayerNonce((value) => value + 1);
    setPlayerStartSeconds(null);
    sentenceStartSecondsRef.current = null;
    sentenceDurationMsRef.current = null;
    repeatEnabledRef.current = false;
    stopPlaybackTimer();
    void resetRecording();
    void resetFollowupRecording();
    setExerciseIndex(0);
    setRevealedSampleAnswerIds({});

    fetchCuratedVideo(currentItem.videoId)
      .then(setActiveVideo)
      .catch((loadError) => {
        console.error("[DailyInputHome] Failed to load video:", loadError);
        setActiveVideo(null);
      })
      .finally(() => setIsVideoLoading(false));
  }, [
    currentItem?.videoId,
    resetFollowupRecording,
    resetRecording,
    stopPlaybackTimer,
  ]);

  useEffect(() => {
    return () => {
      stopPlaybackTimer();
    };
  }, [stopPlaybackTimer]);

  useEffect(() => {
    const active = currentItem;
    if (!active) return;

    const impressionKey = `${active.sessionId}:${active.sentenceId}`;
    if (trackedImpressionsRef.current.has(impressionKey)) return;

    trackedImpressionsRef.current.add(impressionKey);
    trackEvent("daily_input_impression", {
      sessionId: active.sessionId,
      sentenceId: active.sentenceId,
      mode: active.mode,
      cardOrder: active.cardOrder,
      isReview: active.isReview,
    });
  }, [currentItem]);

  const toggleTranslation = useCallback(() => {
    if (!translationKey) return;
    setTranslationMap((current) => ({
      ...current,
      [translationKey]: !current[translationKey],
    }));
  }, [translationKey]);

  const handleSentencePress = useCallback(() => {
    if (!currentItem || !activeVideo) return;
    const nextSeekSeconds =
      activeVideo.snippet_start_time + currentItem.startTime;
    const nextDurationMs = Math.max(
      600,
      Math.round((currentItem.endTime - currentItem.startTime) * 1000) + 250,
    );

    trackEvent("daily_input_seek_play", {
      sessionId: currentItem.sessionId,
      sentenceId: currentItem.sentenceId,
      cardOrder: currentItem.cardOrder,
    });

    stopPlaybackTimer();
    sentenceStartSecondsRef.current = nextSeekSeconds;
    sentenceDurationMsRef.current = nextDurationMs;
    if (isPlayerVisible) {
      playerRef.current?.seekTo(nextSeekSeconds, true);
      setIsPlaying(true);
      return;
    }

    setPlayerStartSeconds(nextSeekSeconds);
    setIsPlayerVisible(true);
    setIsPlaying(true);
  }, [activeVideo, currentItem, isPlayerVisible, stopPlaybackTimer]);

  const handleRepeatToggle = useCallback(() => {
    setIsRepeatEnabled((current) => {
      const next = !current;
      repeatEnabledRef.current = next;

      trackEvent("daily_input_repeat_toggle", {
        enabled: next,
        sessionId: currentItem?.sessionId ?? null,
        sentenceId: currentItem?.sentenceId ?? null,
      });

      return next;
    });
  }, [currentItem?.sentenceId, currentItem?.sessionId]);

  const handleRecordPress = useCallback(async () => {
    if (!currentItem) return;

    if (recordingState === "recording") {
      await stopRecording();
      return;
    }

    if (recordingState === "playback") {
      await resetRecording();
    }

    trackEvent("daily_input_record_start", {
      sessionId: currentItem.sessionId,
      sentenceId: currentItem.sentenceId,
      cardOrder: currentItem.cardOrder,
      mode: currentItem.mode,
    });

    sentenceDurationMsRef.current = null;
    sentenceStartSecondsRef.current = null;
    stopSentencePlayback();
    await startRecording();
  }, [
    currentItem,
    recordingState,
    resetRecording,
    startRecording,
    stopSentencePlayback,
    stopRecording,
  ]);

  const handleOpenSourcePress = useCallback(() => {
    if (!currentItem) return;
    const route =
      currentItem.mode === "expression"
        ? `/study/${currentItem.videoId}?sessionId=${currentItem.sessionId}&sentenceId=${currentItem.sentenceId}&initialTab=transformation`
        : `/study/${currentItem.videoId}?sessionId=${currentItem.sessionId}&sentenceId=${currentItem.sentenceId}&initialTab=shadowing`;

    router.push(route as never);
  }, [currentItem]);

  const handleToggleSampleAnswer = useCallback(() => {
    if (!primaryExercise?.reference_answer || !canRevealSampleAnswer) return;

    if (!isCurrentSampleAnswerRevealed) {
      trackEvent("expression_sample_answer_open", {
        sessionId: currentItem?.sessionId ?? null,
        sentenceId: currentItem?.sentenceId ?? null,
        exerciseId: primaryExercise.id,
      });
    }

    setRevealedSampleAnswerIds((current) => ({
      ...current,
      [primaryExercise.id]: !current[primaryExercise.id],
    }));
  }, [
    canRevealSampleAnswer,
    currentItem?.sentenceId,
    currentItem?.sessionId,
    isCurrentSampleAnswerRevealed,
    primaryExercise,
  ]);

  const handleFollowupRecordPress = useCallback(async () => {
    if (!currentItem || !primaryExercise) return;

    if (followupRecordingState === "recording") {
      await stopFollowupRecording();
      trackEvent("expression_practice_complete", {
        sessionId: currentItem.sessionId,
        sentenceId: currentItem.sentenceId,
        exerciseId: primaryExercise.id,
        entry: "daily_input_followup",
      });
      return;
    }

    if (followupRecordingState === "playback") {
      await resetFollowupRecording();
    }

    trackEvent("expression_practice_start", {
      sessionId: currentItem.sessionId,
      sentenceId: currentItem.sentenceId,
      exerciseId: primaryExercise.id,
      entry: "daily_input_followup",
    });

    await startFollowupRecording();
  }, [
    currentItem,
    followupRecordingState,
    primaryExercise,
    resetFollowupRecording,
    startFollowupRecording,
    stopFollowupRecording,
  ]);

  const handleFollowupPlaybackPress = useCallback(async () => {
    if (!followupAudioUri) return;

    if (isFollowupPlaying) {
      pauseFollowupRecording();
      return;
    }

    await playFollowupRecording();
  }, [
    followupAudioUri,
    isFollowupPlaying,
    pauseFollowupRecording,
    playFollowupRecording,
  ]);

  const handleExerciseStep = useCallback(
    async (direction: "next" | "previous") => {
      if (expressionExercises.length === 0) return;

      const delta = direction === "next" ? 1 : -1;
      const nextIndex = exerciseIndex + delta;
      if (nextIndex < 0 || nextIndex >= expressionExercises.length) {
        return;
      }

      if (followupRecordingState === "recording") {
        await stopFollowupRecording();
      }
      if (followupAudioUri || followupRecordingState === "playback") {
        await resetFollowupRecording();
      }

      setExerciseIndex(nextIndex);
    },
    [
      exerciseIndex,
      expressionExercises.length,
      followupAudioUri,
      followupRecordingState,
      resetFollowupRecording,
      stopFollowupRecording,
    ],
  );

  const resetExerciseCardPosition = useCallback(() => {
    Animated.spring(exercisePanX, {
      toValue: 0,
      tension: 90,
      friction: 14,
      useNativeDriver: true,
    }).start();
  }, [exercisePanX]);

  const animateExerciseTransition = useCallback(
    (direction: "next" | "previous") => {
      const delta = direction === "next" ? 1 : -1;
      const nextIndex = exerciseIndex + delta;
      if (nextIndex < 0 || nextIndex >= expressionExercises.length) {
        resetExerciseCardPosition();
        return;
      }

      Animated.timing(exercisePanX, {
        toValue:
          direction === "next"
            ? -EXERCISE_EXIT_DISTANCE
            : EXERCISE_EXIT_DISTANCE,
        duration: 110,
        useNativeDriver: true,
      }).start(async ({ finished }) => {
        if (!finished) return;

        await handleExerciseStep(direction);
        exercisePanX.setValue(
          direction === "next"
            ? EXERCISE_EXIT_DISTANCE * 0.22
            : -EXERCISE_EXIT_DISTANCE * 0.22,
        );
        Animated.timing(exercisePanX, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }).start();
      });
    },
    [
      exerciseIndex,
      exercisePanX,
      expressionExercises.length,
      handleExerciseStep,
      resetExerciseCardPosition,
    ],
  );

  const exercisePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderRelease: (_, gestureState) => {
          if (
            gestureState.dx <= -EXERCISE_SWIPE_THRESHOLD ||
            gestureState.vx <= -EXERCISE_SWIPE_VELOCITY_THRESHOLD
          ) {
            animateExerciseTransition("next");
            return;
          }

          if (
            gestureState.dx >= EXERCISE_SWIPE_THRESHOLD ||
            gestureState.vx >= EXERCISE_SWIPE_VELOCITY_THRESHOLD
          ) {
            animateExerciseTransition("previous");
            return;
          }

          resetExerciseCardPosition();
        },
      }),
    [animateExerciseTransition, resetExerciseCardPosition],
  );

  const exerciseCardAnimatedStyle = {
    transform: [{ translateX: exercisePanX }],
  } as const;

  const handleOpenPronunciationFollowup = useCallback(() => {
    if (!currentItem) return;

    router.push(
      `/study/${currentItem.videoId}?sessionId=${currentItem.sessionId}&sentenceId=${currentItem.sentenceId}&initialTab=shadowing` as never,
    );
  }, [currentItem]);

  const renderMedia = () => {
    if (!currentItem) return null;

    if (isPlayerVisible && activeVideo?.video_id) {
      return (
        <View style={styles.playerShell}>
          <YouTubePlayer
            key={`${currentItem.videoId}:${currentItem.sentenceId}:${playerNonce}`}
            ref={playerRef}
            videoId={activeVideo.video_id}
            playing={isPlaying}
            startSeconds={
              playerStartSeconds ??
              activeVideo.snippet_start_time + currentItem.startTime
            }
            onReady={() => {
              const seekTarget =
                playerStartSeconds ??
                activeVideo.snippet_start_time + currentItem.startTime;
              setTimeout(() => {
                playerRef.current?.seekTo(seekTarget, true);
              }, 160);
            }}
            onChangeState={(state) => {
              if (state === "playing") {
                scheduleSentencePlaybackStop();
                setIsPlaying(true);
              }
              if (state === "paused" || state === "ended") {
                stopPlaybackTimer();
                setIsPlaying(false);
              }
            }}
          />
        </View>
      );
    }

    return (
      <>
        {currentItem.thumbnailUrl ? (
          <Image
            source={{ uri: currentItem.thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Ionicons
              name="play-circle-outline"
              size={28}
              color={colors.textMuted}
            />
          </View>
        )}
      </>
    );
  };

  const renderTranslationContent = () => (
    <>
      <Text style={styles.sentenceText}>{currentItem?.sentenceText}</Text>
      {isTranslationVisible ? (
        <Text style={styles.translationAnnotation}>
          {currentItem?.translation ?? "아직 번역이 준비되지 않았어요."}
        </Text>
      ) : null}
    </>
  );

  const renderActionContent = () => (
    <>
      <View style={styles.actionRow}>
        <ActionIconButton
          accessibilityLabel="번역 보기 토글"
          iconName={isTranslationVisible ? "language" : "language-outline"}
          isActive={isTranslationVisible}
          label="번역"
          onPress={toggleTranslation}
        />
        <ActionIconButton
          accessibilityLabel={
            recordingState === "recording" ? "녹음 중지" : "즉시 녹음 시작"
          }
          iconName={recordingState === "recording" ? "stop" : "mic"}
          label={recordingState === "recording" ? "중지" : "녹음"}
          onPress={() => void handleRecordPress()}
          variant="primary"
        />
        <ActionIconButton
          accessibilityLabel="반복 재생 토글"
          iconName={isRepeatEnabled ? "repeat" : "repeat-outline"}
          isActive={isRepeatEnabled}
          label="반복"
          onPress={handleRepeatToggle}
        />
      </View>
      {recordingState === "recording" ? (
        <Text style={styles.recordingStatusCaption}>
          녹음 중 {formatDuration(duration)}
        </Text>
      ) : null}
    </>
  );

  const cardAnimatedStyle = {
    transform: [{ translateX: panX }, { scale: 1 }],
  } as const;

  const previousCardAnimatedStyle = {
    opacity: panX.interpolate({
      inputRange: [-140, -24, 0],
      outputRange: [0.88, 0.56, 0.32],
      extrapolate: "clamp",
    }),
    transform: [
      {
        translateX: panX.interpolate({
          inputRange: [-180, 0],
          outputRange: [-CARD_PREVIEW_OFFSET, -CARD_PREVIEW_OFFSET - 18],
          extrapolate: "clamp",
        }),
      },
      {
        scale: panX.interpolate({
          inputRange: [-180, 0],
          outputRange: [0.98, 0.94],
          extrapolate: "clamp",
        }),
      },
    ],
  } as const;

  const nextCardAnimatedStyle = {
    opacity: panX.interpolate({
      inputRange: [0, 24, 140],
      outputRange: [0.32, 0.56, 0.88],
      extrapolate: "clamp",
    }),
    transform: [
      {
        translateX: panX.interpolate({
          inputRange: [0, 180],
          outputRange: [CARD_PREVIEW_OFFSET + 18, CARD_PREVIEW_OFFSET],
          extrapolate: "clamp",
        }),
      },
      {
        scale: panX.interpolate({
          inputRange: [0, 180],
          outputRange: [0.94, 0.98],
          extrapolate: "clamp",
        }),
      },
    ],
  } as const;

  const renderFollowUpSurface = () => {
    if (!currentItem || !learningProfile?.goal_mode) return null;

    if (learningProfile.goal_mode === "pronunciation") {
      const focusTags = getPronunciationFocusTags(
        learningProfile.preferred_speakers.length > 0
          ? learningProfile.preferred_speakers
          : learningProfile.focus_tags,
      );
      const hasRecordedAttempt = Boolean(audioUri);

      return (
        <View style={styles.followupCard}>
          <View style={styles.followupHeader}>
            <Text style={styles.followupEyebrow}>발음 교정 세션</Text>
            <Text style={styles.followupTitle}>
              {hasRecordedAttempt
                ? "방금 녹음한 시도를 기준으로 교정하러 가기"
                : "먼저 한 번 따라 말해보면 교정 세션이 준비돼요"}
            </Text>
          </View>
          <Text style={styles.followupBody}>
            {hasRecordedAttempt
              ? "현재 문장을 다시 들으면서 속도, 끊어읽기, 문장 끝 처리를 중심으로 교정해볼 수 있어요."
              : "위의 녹음 버튼으로 한 번 말해본 뒤 교정 세션에서 무엇을 훔쳐야 할지 정리해드릴게요."}
          </Text>
          <View style={styles.followupTagRow}>
            {focusTags.map((tag) => (
              <View key={tag} style={styles.followupTag}>
                <Text style={styles.followupTagText}>{tag}</Text>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="발음 교정 세션 열기"
            style={[
              styles.followupPrimaryButton,
              !hasRecordedAttempt && styles.followupPrimaryButtonDisabled,
            ]}
            onPress={handleOpenPronunciationFollowup}
            disabled={!hasRecordedAttempt}
          >
            <Text style={styles.followupPrimaryButtonText}>
              {hasRecordedAttempt ? "교정 세션 열기" : "녹음 후 열기"}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.followupCard}>
        {primaryExercise ? (
          <>
            {expressionIntroCopy.headline || expressionIntroCopy.body ? (
              <View style={styles.expressionIntroBlock}>
                {expressionIntroCopy.headline ? (
                  <Text style={styles.expressionIntroHeadline}>
                    {expressionIntroCopy.headline}
                  </Text>
                ) : null}
                {expressionIntroCopy.body ? (
                  <Text style={styles.expressionIntroBody}>
                    {expressionIntroCopy.body}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View
              style={styles.practiceCard}
              {...exercisePanResponder.panHandlers}
            >
              <Animated.View style={exerciseCardAnimatedStyle}>
                <View style={styles.practiceCardHeader}>
                  <View style={styles.practiceDotsRow}>
                    {expressionExercises.map((exercise, index) => (
                      <View
                        key={exercise.id}
                        style={[
                          styles.practiceDot,
                          index === exerciseIndex && styles.practiceDotActive,
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.practiceCardInstruction}>
                  {getExerciseInstruction(primaryExercise)}
                </Text>
                <Text style={styles.practiceCardPrompt}>
                  {getExercisePrompt(primaryExercise)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    followupRecordingState === "recording"
                      ? "표현 연습 녹음 완료"
                      : "표현 연습 녹음 시작"
                  }
                  style={styles.followupRecordButton}
                  onPress={() => void handleFollowupRecordPress()}
                >
                  <Ionicons
                    name={
                      followupRecordingState === "recording" ? "stop" : "mic"
                    }
                    size={18}
                    color={colors.bg}
                  />
                  <Text style={styles.followupRecordButtonText}>
                    {followupRecordingState === "recording"
                      ? `녹음 완료 ${formatDuration(followupDuration)}`
                      : "말해보기"}
                  </Text>
                </Pressable>
              </Animated.View>
            </View>

            {followupAudioUri ? (
              <View style={styles.followupPlaybackSection}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    isFollowupPlaying ? "녹음 듣기 일시정지" : "녹음 듣기 재생"
                  }
                  style={styles.followupPlaybackButton}
                  onPress={() => void handleFollowupPlaybackPress()}
                >
                  <Ionicons
                    name={isFollowupPlaying ? "pause" : "play"}
                    size={18}
                    color={colors.text}
                  />
                  <Text style={styles.followupPlaybackButtonText}>
                    {isFollowupPlaying ? "듣는 중" : "내 녹음 듣기"}
                  </Text>
                </Pressable>

                {primaryExercise.reference_answer ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="모범답안 보기"
                    style={styles.sampleAnswerCard}
                    onPress={handleToggleSampleAnswer}
                    disabled={!canRevealSampleAnswer}
                  >
                    <Text style={styles.sampleAnswerText}>
                      {primaryExercise.reference_answer}
                    </Text>
                    {!isCurrentSampleAnswerRevealed ? (
                      <BlurView
                        intensity={22}
                        tint="light"
                        style={styles.sampleAnswerBlur}
                      >
                        <Text style={styles.sampleAnswerBlurText}>
                          눌러서 모범답안 보기
                        </Text>
                      </BlurView>
                    ) : null}
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.followupBody}>
              이 카드와 연결된 변형 연습이 아직 준비되지 않았어요. 전체 학습
              화면에서 바로 연습을 이어갈 수 있어요.
            </Text>
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>오늘의 인풋</Text>

        {isLoading || isProfileLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>
              오늘 학습 카드를 고르고 있어요…
            </Text>
          </View>
        ) : null}

        {!isLoading && !isProfileLoading && !learningProfile?.goal_mode ? (
          <View style={styles.stateCard}>
            <Text style={styles.emptyTitle}>학습 모드를 먼저 정해주세요</Text>
            <Text style={styles.stateText}>
              발음 훔치기인지, 표현 훔치기인지에 따라 홈 카드가 달라져요.
            </Text>
            <Pressable
              style={styles.stateButton}
              onPress={() => router.push("/onboarding?edit=1" as never)}
            >
              <Text style={styles.stateButtonText}>학습 설정 열기</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading && !isProfileLoading && error ? (
          <View style={styles.stateCard}>
            <Text style={styles.emptyTitle}>{error}</Text>
            <Pressable
              style={styles.stateButton}
              onPress={() => void loadQueue()}
            >
              <Text style={styles.stateButtonText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading &&
        !isProfileLoading &&
        !error &&
        learningProfile?.goal_mode &&
        currentItem ? (
          <>
            <View style={styles.queueMetaRow}>
              <Text style={styles.queueMetaCount}>
                {activeIndex + 1} / {queue.length}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${currentItem.title} 원본 영상 열기`}
                style={styles.queueMetaLink}
                onPress={handleOpenSourcePress}
              >
                <Text style={styles.queueMetaTitle} numberOfLines={1}>
                  {currentItem.title}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={14}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            <View style={styles.cardStage} {...panResponder.panHandlers}>
              <View style={styles.cardRail}>
                {previousItem ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.cardPreview,
                      styles.cardPreviewPrevious,
                      previousCardAnimatedStyle,
                    ]}
                  >
                    <View style={styles.cardPreviewInner}>
                      <Text style={styles.cardPreviewText} numberOfLines={2}>
                        {previousItem.sentenceText}
                      </Text>
                    </View>
                  </Animated.View>
                ) : null}

                {nextItem ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.cardPreview,
                      styles.cardPreviewNext,
                      nextCardAnimatedStyle,
                    ]}
                  >
                    <View style={styles.cardPreviewInner}>
                      <Text style={styles.cardPreviewText} numberOfLines={2}>
                        {nextItem.sentenceText}
                      </Text>
                    </View>
                  </Animated.View>
                ) : null}

                <Animated.View style={cardAnimatedStyle}>
                  <DailyQueueCard
                    mediaContent={renderMedia()}
                    onSentencePress={handleSentencePress}
                    translationContent={renderTranslationContent()}
                    actionContent={renderActionContent()}
                  />
                </Animated.View>
              </View>
            </View>

            {renderFollowUpSurface()}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  title: {
    paddingHorizontal: spacing.lg,
    fontSize: 28,
    lineHeight: 34,
    color: colors.text,
    fontWeight: font.weight.bold,
  },
  stateCard: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.bgSubtle,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
  },
  stateText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
    fontWeight: font.weight.semibold,
    textAlign: "center",
  },
  stateButton: {
    marginTop: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  stateButtonText: {
    fontSize: 14,
    color: colors.bg,
    fontWeight: font.weight.semibold,
  },
  queueMetaRow: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  queueMetaCount: {
    fontSize: 16,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  queueMetaLink: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  queueMetaTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    fontWeight: font.weight.medium,
  },
  cardStage: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  cardRail: {
    position: "relative",
    overflow: "visible",
  },
  cardPreview: {
    position: "absolute",
    top: spacing.sm,
    bottom: 0,
    left: 0,
    right: 0,
  },
  cardPreviewPrevious: {},
  cardPreviewNext: {},
  cardPreviewInner: {
    flex: 1,
    borderRadius: radius.xl,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  cardPreviewText: {
    fontSize: 18,
    lineHeight: 26,
    color: colors.textMuted,
    fontWeight: font.weight.medium,
  },
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.bgSubtle,
    overflow: "hidden",
  },
  mediaBlock: {
    width: "100%",
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: colors.bgMuted,
  },
  thumbnailPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  playerShell: {
    overflow: "hidden",
    position: "relative",
    backgroundColor: colors.bgMuted,
  },
  sentenceBlock: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sentenceButton: {
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sentenceText: {
    fontSize: 20,
    lineHeight: 30,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  translationAnnotation: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  actionGroup: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  actionButtonItem: {
    width: 84,
    alignItems: "center",
    gap: spacing.xs,
  },
  actionIconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconButtonPrimary: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  actionIconButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionIconLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: font.weight.medium,
  },
  actionIconLabelPrimary: {
    color: colors.text,
  },
  actionIconLabelActive: {
    color: colors.primary,
  },
  recordingStatusCaption: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    fontWeight: font.weight.medium,
    textAlign: "center",
  },
  followupCard: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
    padding: spacing.xl,
    gap: spacing.md,
  },
  expressionFollowupCard: {},
  followupHeader: {
    gap: spacing.xs,
  },
  followupEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.primary,
    fontWeight: font.weight.semibold,
  },
  followupTitle: {
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  followupBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  followupTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  followupTag: {
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followupTagText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
    fontWeight: font.weight.medium,
  },
  followupPrimaryButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  followupPrimaryButtonDisabled: {
    backgroundColor: colors.border,
  },
  followupPrimaryButtonText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.bg,
    fontWeight: font.weight.semibold,
  },
  followupLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  followupLoadingText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  practiceCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  practiceCardHeader: {
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  expressionIntroBlock: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  expressionIntroHeadline: {
    fontSize: 18,
    lineHeight: 26,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  expressionIntroBody: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.text,
  },
  practiceCardInstruction: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    fontWeight: font.weight.medium,
    marginBottom: spacing.sm,
  },
  practiceCardPrompt: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    fontWeight: font.weight.medium,
    marginBottom: spacing.sm,
  },
  practiceDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  practiceDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.borderStrong,
  },
  practiceDotActive: {
    width: 18,
    backgroundColor: colors.textSecondary,
  },
  followupRecordButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  followupRecordButtonText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.bg,
    fontWeight: font.weight.semibold,
  },
  followupPlaybackSection: {
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  followupPlaybackButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  followupPlaybackButtonText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
    fontWeight: font.weight.medium,
  },
  sampleAnswerCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sampleAnswerText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  sampleAnswerBlur: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  sampleAnswerBlurText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
    fontWeight: font.weight.semibold,
    textAlign: "center",
  },
});
