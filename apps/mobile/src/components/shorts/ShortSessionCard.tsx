import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type {
  CuratedVideo,
  SavedSentence,
  Sentence,
} from "@inputenglish/shared";
import type { SessionListItem } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import YouTubePlayer, {
  type YouTubePlayerHandle,
} from "@/components/player/YouTubePlayer";
import ScriptLine, {
  SCRIPT_LINE_HEIGHT,
} from "@/components/listening/ScriptLine";
import {
  getAdjacentSentence,
  resolveSentencesByIdsOrRange,
} from "@/lib/transcript-navigation";
import { appStore } from "@/lib/stores";
import { colors, font, radius, spacing } from "@/theme";

interface ShortSessionCardProps {
  session: SessionListItem;
  isActive: boolean;
  shouldLoad: boolean;
  scriptVisible: boolean;
  showTranslation: boolean;
  topOverlayInset?: number;
  bottomOverlayInset?: number;
  video: CuratedVideo | null;
  videoState: {
    status: "idle" | "loading" | "loaded" | "error";
    error?: string | null;
  };
  onRetryVideoLoad: (videoId: string) => Promise<CuratedVideo | null>;
  navigationRequest?: {
    direction: "prev" | "next";
    nonce: number;
  } | null;
  onActiveSentenceChange?: (sentenceId: string | null) => void;
}

function ShortSessionCard({
  session,
  isActive,
  shouldLoad,
  scriptVisible,
  showTranslation,
  topOverlayInset = 0,
  bottomOverlayInset = 0,
  video,
  videoState,
  onRetryVideoLoad,
  navigationRequest = null,
  onActiveSentenceChange,
}: ShortSessionCardProps) {
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loopingSentenceId, setLoopingSentenceId] = useState<string | null>(
    null,
  );
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const [transcriptOffset, setTranscriptOffset] = useState(0);

  const playerRef = useRef<YouTubePlayerHandle>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const sentenceOffsetsRef = useRef<Record<string, number>>({});
  const lastAlignedSentenceIdRef = useRef<string | null>(null);
  const shouldResetScriptPositionRef = useRef(true);
  const activeSessionIdRef = useRef(session.id);
  const isCardActiveRef = useRef(isActive);
  const pendingSentenceRef = useRef<Sentence | null>(null);
  const pendingAutoplayRef = useRef(false);
  const loopingSentenceIdRef = useRef<string | null>(null);
  const hasTrackedImpressionRef = useRef(false);
  const activeSentenceIdRef = useRef<string | null>(null);
  const scriptViewportHeightRef = useRef(0);
  const scriptContentHeightRef = useRef(0);
  const handledNavigationNonceRef = useRef<number | null>(null);

  const savedSentences = appStore((state) => state.savedSentences);
  const addSavedSentence = appStore((state) => state.addSavedSentence);
  const removeSavedSentence = appStore((state) => state.removeSavedSentence);

  const sentences = useMemo(
    () =>
      resolveSentencesByIdsOrRange(
        video?.transcript ?? [],
        session.sentence_ids,
        session.start_time,
        session.end_time,
      ),
    [session.end_time, session.sentence_ids, session.start_time, video],
  );
  const isVideoLoading =
    videoState.status === "loading" ||
    (shouldLoad && !video && videoState.status !== "error");
  const videoError =
    videoState.status === "error"
      ? (videoState.error ?? "세션 영상을 불러오지 못했어요.")
      : null;

  const sessionStartSeconds =
    (video?.snippet_start_time ?? 0) + (session.start_time ?? 0);
  const sessionEndSeconds =
    (video?.snippet_start_time ?? 0) +
    (session.end_time ?? (session.start_time ?? 0) + (session.duration || 0));

  const clearPlaybackTimeout = useCallback(() => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  }, []);

  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const clampTranscriptOffset = useCallback((offset: number) => {
    const maxOffset = Math.max(
      scriptContentHeightRef.current - scriptViewportHeightRef.current,
      0,
    );
    return Math.max(0, Math.min(offset, maxOffset));
  }, []);

  const updateTranscriptOffset = useCallback(
    (offset: number) => {
      setTranscriptOffset(clampTranscriptOffset(offset));
    },
    [clampTranscriptOffset],
  );

  const resetScriptScrollPosition = useCallback(() => {
    shouldResetScriptPositionRef.current = true;
    lastAlignedSentenceIdRef.current = null;
    sentenceOffsetsRef.current = {};
    scriptViewportHeightRef.current = 0;
    scriptContentHeightRef.current = 0;
    updateTranscriptOffset(0);
  }, [updateTranscriptOffset]);

  const alignTranscriptToSentence = useCallback(
    (sentenceId: string) => {
      const sentenceOffset = sentenceOffsetsRef.current[sentenceId];
      const fallbackIndex = sentences.findIndex(
        (sentence) => sentence.id === sentenceId,
      );
      const targetOffset =
        typeof sentenceOffset === "number"
          ? sentenceOffset
          : Math.max(fallbackIndex, 0) * SCRIPT_LINE_HEIGHT;

      updateTranscriptOffset(Math.max(targetOffset - spacing.xs, 0));
      lastAlignedSentenceIdRef.current = sentenceId;
    },
    [sentences, updateTranscriptOffset],
  );

  const syncActiveSentence = useCallback(async () => {
    if (!video || !playerReady || sentences.length === 0) return;
    const requestedSessionId = activeSessionIdRef.current;

    const currentTime = await playerRef.current?.getCurrentTime();
    if (
      typeof currentTime !== "number" ||
      Number.isNaN(currentTime) ||
      !isCardActiveRef.current ||
      activeSessionIdRef.current !== requestedSessionId
    ) {
      return;
    }

    const clipSeconds = currentTime - (video.snippet_start_time ?? 0);
    const currentSentence =
      sentences.find(
        (sentence) =>
          clipSeconds >= sentence.startTime && clipSeconds <= sentence.endTime,
      ) ?? null;

    setActiveSentenceId((current) =>
      current === (currentSentence?.id ?? null)
        ? current
        : (currentSentence?.id ?? null),
    );
  }, [playerReady, sentences, video]);

  const stopPlayback = useCallback(() => {
    clearPlaybackTimeout();
    clearProgressInterval();
    setPlaying(false);
  }, [clearPlaybackTimeout, clearProgressInterval]);

  const startSessionPlayback = useCallback(() => {
    if (!video) return;

    clearPlaybackTimeout();
    setLoopingSentenceId(null);
    setActiveSentenceId(null);

    if (!playerReady) {
      pendingAutoplayRef.current = true;
      setPlaying(true);
      return;
    }

    playerRef.current?.seekTo(sessionStartSeconds, true);
    setPlaying(true);
    pendingAutoplayRef.current = false;

    const durationMs = Math.max(
      (sessionEndSeconds - sessionStartSeconds) * 1000,
      1000,
    );
    stopTimeoutRef.current = setTimeout(() => {
      setPlaying(false);
    }, durationMs);
  }, [
    clearPlaybackTimeout,
    playerReady,
    sessionEndSeconds,
    sessionStartSeconds,
    video,
  ]);

  const playSentence = useCallback(
    (sentence: Sentence) => {
      if (!playerReady || !video) {
        pendingSentenceRef.current = sentence;
        pendingAutoplayRef.current = true;
        return;
      }

      clearPlaybackTimeout();
      const seekSeconds = (video.snippet_start_time ?? 0) + sentence.startTime;
      const durationMs = Math.max(
        (sentence.endTime - sentence.startTime) * 1000,
        450,
      );

      pendingSentenceRef.current = null;
      pendingAutoplayRef.current = false;
      setActiveSentenceId(sentence.id);
      setPlaying(true);
      playerRef.current?.seekTo(seekSeconds, true);

      stopTimeoutRef.current = setTimeout(() => {
        if (loopingSentenceIdRef.current === sentence.id) {
          playSentence(sentence);
          return;
        }

        setPlaying(false);
      }, durationMs);
    },
    [clearPlaybackTimeout, playerReady, video],
  );

  useEffect(() => {
    activeSessionIdRef.current = session.id;
  }, [session.id]);

  useEffect(() => {
    isCardActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    loopingSentenceIdRef.current = loopingSentenceId;
  }, [loopingSentenceId]);

  useEffect(() => {
    activeSentenceIdRef.current = activeSentenceId;
  }, [activeSentenceId]);

  useEffect(() => {
    onActiveSentenceChange?.(isActive ? activeSentenceId : null);
  }, [activeSentenceId, isActive, onActiveSentenceChange]);

  useEffect(() => {
    if (!isActive) {
      pendingSentenceRef.current = null;
      pendingAutoplayRef.current = false;
      resetScriptScrollPosition();
      setLoopingSentenceId(null);
      setActiveSentenceId(null);
      stopPlayback();
    }
  }, [isActive, resetScriptScrollPosition, stopPlayback]);

  useEffect(() => {
    if (!isActive) return;
    resetScriptScrollPosition();
  }, [isActive, resetScriptScrollPosition]);

  useEffect(() => {
    setPlayerReady(false);
    setPlaying(false);
    hasTrackedImpressionRef.current = false;
    handledNavigationNonceRef.current = null;
    resetScriptScrollPosition();
    setLoopingSentenceId(null);
    setActiveSentenceId(null);
  }, [resetScriptScrollPosition, session.id, video?.video_id]);

  useEffect(() => {
    sentenceOffsetsRef.current = {};
    lastAlignedSentenceIdRef.current = null;
  }, [showTranslation]);

  useEffect(() => {
    if (!scriptVisible) {
      resetScriptScrollPosition();
    }
  }, [resetScriptScrollPosition, scriptVisible]);

  useEffect(() => {
    if (!isActive || !video) return;
    startSessionPlayback();
  }, [isActive, startSessionPlayback, video?.video_id]);

  useEffect(() => {
    if (!isActive || hasTrackedImpressionRef.current) return;

    hasTrackedImpressionRef.current = true;
    trackEvent("shorts_session_impression", {
      sessionId: session.id,
      videoId: session.source_video_id,
      sourceType: session.source_type ?? "unknown",
    });
  }, [isActive, session.id, session.source_type, session.source_video_id]);

  useEffect(() => {
    if (!playerReady || !isActive) return;

    if (pendingSentenceRef.current) {
      playSentence(pendingSentenceRef.current);
      return;
    }

    if (pendingAutoplayRef.current) {
      playerRef.current?.seekTo(sessionStartSeconds, true);
      setPlaying(true);
      pendingAutoplayRef.current = false;
      const durationMs = Math.max(
        (sessionEndSeconds - sessionStartSeconds) * 1000,
        1000,
      );
      stopTimeoutRef.current = setTimeout(() => {
        setPlaying(false);
      }, durationMs);
    }
  }, [
    isActive,
    playSentence,
    playerReady,
    sessionEndSeconds,
    sessionStartSeconds,
  ]);

  useEffect(() => {
    return () => {
      clearPlaybackTimeout();
      clearProgressInterval();
    };
  }, [clearPlaybackTimeout, clearProgressInterval]);

  useEffect(() => {
    if (
      !isActive ||
      !playing ||
      !playerReady ||
      !video ||
      sentences.length === 0
    ) {
      clearProgressInterval();
      return;
    }

    void syncActiveSentence();
    progressIntervalRef.current = setInterval(() => {
      void syncActiveSentence();
    }, 250);

    return () => {
      clearProgressInterval();
    };
  }, [
    clearProgressInterval,
    isActive,
    playerReady,
    playing,
    sentences.length,
    syncActiveSentence,
    video,
  ]);

  const handleSentencePress = useCallback(
    (sentence: Sentence) => {
      playSentence(sentence);
    },
    [playSentence],
  );

  const handleSentenceLayout = useCallback(
    (sentenceId: string, event: LayoutChangeEvent) => {
      sentenceOffsetsRef.current[sentenceId] = event.nativeEvent.layout.y;
    },
    [],
  );

  const handleScriptViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      scriptViewportHeightRef.current = event.nativeEvent.layout.height;
      if (
        activeSentenceIdRef.current &&
        !shouldResetScriptPositionRef.current
      ) {
        alignTranscriptToSentence(activeSentenceIdRef.current);
      }
    },
    [alignTranscriptToSentence],
  );

  const handleScriptContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      scriptContentHeightRef.current = event.nativeEvent.layout.height;

      if (shouldResetScriptPositionRef.current) {
        shouldResetScriptPositionRef.current = false;
        updateTranscriptOffset(0);
        return;
      }

      if (
        activeSentenceIdRef.current &&
        scriptVisible &&
        isCardActiveRef.current
      ) {
        alignTranscriptToSentence(activeSentenceIdRef.current);
      }
    },
    [alignTranscriptToSentence, scriptVisible, updateTranscriptOffset],
  );

  useEffect(() => {
    if (!isActive || !scriptVisible || !activeSentenceId) return;
    if (shouldResetScriptPositionRef.current) return;
    if (lastAlignedSentenceIdRef.current === activeSentenceId) return;

    const frame = requestAnimationFrame(() => {
      alignTranscriptToSentence(activeSentenceId);
    });

    return () => cancelAnimationFrame(frame);
  }, [
    activeSentenceId,
    alignTranscriptToSentence,
    isActive,
    scriptVisible,
    showTranslation,
  ]);

  useEffect(() => {
    if (!isActive || !navigationRequest) return;
    if (navigationRequest.nonce === handledNavigationNonceRef.current) return;

    handledNavigationNonceRef.current = navigationRequest.nonce;

    const nextSentence = getAdjacentSentence(
      sentences,
      activeSentenceIdRef.current,
      navigationRequest.direction,
    );

    if (nextSentence) {
      playSentence(nextSentence);
    }
  }, [isActive, navigationRequest, playSentence, sentences]);

  const handleLoopToggle = useCallback(
    (sentence: Sentence) => {
      setLoopingSentenceId((current) => {
        const next = current === sentence.id ? null : sentence.id;
        loopingSentenceIdRef.current = next;

        if (next) {
          playSentence(sentence);
        } else {
          clearPlaybackTimeout();
          setPlaying(false);
        }

        return next;
      });
    },
    [clearPlaybackTimeout, playSentence],
  );

  const handleSentenceSaveToggle = useCallback(
    (sentence: Sentence) => {
      const existing = savedSentences.find(
        (item) =>
          item.sentenceId === sentence.id &&
          item.videoId === session.source_video_id,
      );

      if (existing) {
        void removeSavedSentence(existing.id);
        return;
      }

      void addSavedSentence({
        id: crypto.randomUUID(),
        videoId: session.source_video_id,
        sentenceId: sentence.id,
        sentenceText: sentence.text,
        startTime: sentence.startTime,
        endTime: sentence.endTime,
        createdAt: Date.now(),
      } as SavedSentence);
    },
    [
      addSavedSentence,
      removeSavedSentence,
      savedSentences,
      session.source_video_id,
    ],
  );

  return (
    <View style={styles.container}>
      <View style={styles.playerCard}>
        {isVideoLoading ? (
          <View style={styles.playerPlaceholder}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.placeholderText}>세션을 준비하고 있어요…</Text>
          </View>
        ) : videoError ? (
          <View style={styles.playerPlaceholder}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={colors.error}
            />
            <Text style={styles.errorText}>{videoError}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${session.title} 클립 다시 불러오기`}
              style={styles.retryButton}
              onPress={() => {
                void onRetryVideoLoad(session.source_video_id);
              }}
            >
              <Text style={styles.retryButtonText}>다시 불러오기</Text>
            </Pressable>
          </View>
        ) : video ? (
          <YouTubePlayer
            ref={playerRef}
            videoId={video.video_id}
            playing={isActive && playing}
            startSeconds={sessionStartSeconds}
            onReady={() => setPlayerReady(true)}
            onChangeState={(state) => {
              if (state === "playing") {
                setPlaying(true);
              }

              if (state === "paused" || state === "ended") {
                setPlaying(false);
              }
            }}
          />
        ) : (
          <View style={styles.playerPlaceholder}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.placeholderText}>
              {shouldLoad
                ? "클립을 불러오는 중이에요…"
                : "다음 클립을 준비하고 있어요…"}
            </Text>
          </View>
        )}
      </View>

      <View
        style={[
          styles.scriptCard,
          topOverlayInset > 0 ? { marginTop: topOverlayInset } : null,
        ]}
        onLayout={handleScriptViewportLayout}
      >
        {/* Keep only the outer shorts pager scrollable; transcript movement is programmatic. */}
        <View
          key={`${session.id}-${video?.video_id ?? "pending"}-${
            showTranslation ? "translation" : "original"
          }-${isActive ? "active" : "inactive"}`}
          style={[
            styles.scriptContent,
            {
              paddingBottom: spacing.xl + bottomOverlayInset,
              transform: [{ translateY: -transcriptOffset }],
            },
          ]}
          onLayout={handleScriptContentLayout}
        >
          {!scriptVisible ? (
            <View style={styles.scriptHiddenState} />
          ) : sentences.length > 0 ? (
            sentences.map((sentence) => (
              <View
                key={sentence.id}
                onLayout={(event) => handleSentenceLayout(sentence.id, event)}
              >
                <ScriptLine
                  sentence={sentence}
                  isActive={activeSentenceId === sentence.id}
                  isLooping={loopingSentenceId === sentence.id}
                  isSaved={savedSentences.some(
                    (item) =>
                      item.sentenceId === sentence.id &&
                      item.videoId === session.source_video_id,
                  )}
                  tone="dark"
                  scriptHidden={false}
                  showActions={false}
                  showTranslation={showTranslation}
                  onTap={handleSentencePress}
                  onLoopToggle={handleLoopToggle}
                  onSaveToggle={handleSentenceSaveToggle}
                />
              </View>
            ))
          ) : (
            <Text style={styles.placeholderText}>
              스크립트를 준비하는 중이에요.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

function arePropsEqual(
  prev: ShortSessionCardProps,
  next: ShortSessionCardProps,
): boolean {
  return (
    prev.session.id === next.session.id &&
    prev.isActive === next.isActive &&
    prev.shouldLoad === next.shouldLoad &&
    prev.scriptVisible === next.scriptVisible &&
    prev.showTranslation === next.showTranslation &&
    prev.video?.video_id === next.video?.video_id &&
    prev.videoState.status === next.videoState.status &&
    prev.videoState.error === next.videoState.error &&
    prev.navigationRequest?.nonce === next.navigationRequest?.nonce &&
    prev.topOverlayInset === next.topOverlayInset &&
    prev.bottomOverlayInset === next.bottomOverlayInset
  );
}

export default React.memo(ShortSessionCard, arePropsEqual);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  playerCard: {
    overflow: "hidden",
    backgroundColor: colors.bgDark,
  },
  playerPlaceholder: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.bgDark,
  },
  placeholderText: {
    fontSize: font.size.sm,
    lineHeight: 20,
    color: colors.textOnDarkMuted,
    textAlign: "center",
  },
  errorText: {
    fontSize: font.size.sm,
    lineHeight: 20,
    color: colors.error,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderOnDarkStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  retryButtonText: {
    fontSize: font.size.sm,
    lineHeight: 18,
    color: colors.textOnDark,
    fontWeight: font.weight.medium,
  },
  scriptCard: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.bgDark,
    overflow: "hidden",
  },
  scriptContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  scriptHiddenState: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    minHeight: 160,
    opacity: 0.01,
  },
});
