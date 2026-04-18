import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
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
import { useAuth } from "@/contexts/AuthContext";
import { fetchCuratedVideo } from "@/lib/api";
import { DailyInputQueueItem, getDailyInputQueue } from "@/lib/daily-input";
import { trackEvent } from "@/lib/analytics";
import YouTubePlayer, {
  YouTubePlayerHandle,
} from "@/components/player/YouTubePlayer";
import useAudioRecorder from "@/hooks/useAudioRecorder";
import type { CuratedVideo } from "@inputenglish/shared";
import { colors, font, radius, spacing } from "@/theme";

const SWIPE_THRESHOLD = 56;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

  const {
    recordingState,
    duration,
    startRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder();

  const currentItem = queue[activeIndex] ?? null;
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
          Math.abs(gestureState.dx) > 10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx <= -SWIPE_THRESHOLD) {
            moveToIndex(activeIndex + 1);
            return;
          }
          if (gestureState.dx >= SWIPE_THRESHOLD) {
            moveToIndex(activeIndex - 1);
          }
        },
      }),
    [activeIndex, moveToIndex],
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
    setActiveVideo(null);
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

    fetchCuratedVideo(currentItem.videoId)
      .then(setActiveVideo)
      .catch((loadError) => {
        console.error("[DailyInputHome] Failed to load video:", loadError);
        setActiveVideo(null);
      })
      .finally(() => setIsVideoLoading(false));
  }, [currentItem?.videoId, resetRecording, stopPlaybackTimer]);

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroBlock}>
          <Text style={styles.eyebrow}>오늘의 학습 중심</Text>
          <Text style={styles.title}>오늘의 인풋</Text>
          <Text style={styles.subtitle}>
            오늘은 많아도 3개까지만. 카드 안에서 듣고, 번역 보고, 바로 말해보는
            흐름으로 바꿨습니다.
          </Text>
        </View>

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
              <DailyQueueCard
                mediaContent={renderMedia()}
                onSentencePress={handleSentencePress}
                translationContent={renderTranslationContent()}
                actionContent={renderActionContent()}
              />
            </View>

            <View style={styles.indicatorRow}>
              {queue.map((item, index) => (
                <View
                  key={`${item.sessionId}:${index}`}
                  style={[
                    styles.indicatorDot,
                    index === activeIndex && styles.indicatorDotActive,
                  ]}
                />
              ))}
            </View>

            <View style={styles.footerHint}>
              <Ionicons
                name="swap-horizontal"
                size={16}
                color={colors.textMuted}
              />
              <Text style={styles.footerHintText}>
                카드를 좌우로 넘겨 오늘 학습할 다음 인풋으로 이동하세요
              </Text>
            </View>
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
  heroBlock: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  eyebrow: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: font.weight.semibold,
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    color: colors.text,
    fontWeight: font.weight.bold,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
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
    fontSize: 24,
    lineHeight: 34,
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
  indicatorRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  indicatorDotActive: {
    width: 20,
    backgroundColor: colors.text,
  },
  footerHint: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  footerHintText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
