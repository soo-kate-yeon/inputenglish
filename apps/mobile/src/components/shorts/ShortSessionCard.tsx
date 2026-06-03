// @MX:NOTE: Shorts session card — audio↔transcript sync (100ms polling) and
//   active-sentence auto-scroll. The transcript is a plain ScrollView (NOT a
//   FlatList) because it is nested inside the vertical paging shorts feed:
//   nesting a same-orientation VirtualizedList breaks programmatic scroll.
//   ScrollView.scrollTo works even with scrollEnabled=false, so the feed keeps
//   its swipe gesture while we drive the active line to the top via measured
//   row offsets (re-applied when onLayout reports a row's real position).
// @MX:SPEC: SPEC-MOBILE-019
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
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
import { safeSelectionAsync, safeImpactAsync } from "@/lib/safeHaptic";
import { ImpactFeedbackStyle } from "expo-haptics";
import YouTubePlayer, {
  type YouTubePlayerHandle,
} from "@/components/player/YouTubePlayer";
import ScriptLine from "@/components/listening/ScriptLine";
import {
  getAdjacentSentence,
  resolveSentencesByIdsOrRange,
} from "@/lib/transcript-navigation";
import { arePropsEqual } from "@/components/shorts/short-session-card-memo";
import { useShortsUI } from "@/contexts/ShortsUIContext";
import { appStore } from "@/lib/stores";
import { colors, font, leading, radius, spacing } from "@/theme";

interface ShortSessionCardProps {
  session: SessionListItem;
  isActive: boolean;
  shouldLoad: boolean;
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
  onSessionEnd?: () => void;
}

function ShortSessionCard({
  session,
  isActive,
  shouldLoad,
  topOverlayInset = 0,
  bottomOverlayInset = 0,
  video,
  videoState,
  onRetryVideoLoad,
  navigationRequest = null,
  onActiveSentenceChange,
  onSessionEnd,
}: ShortSessionCardProps) {
  const { scriptVisible, showTranslation } = useShortsUI();
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loopingSentenceId, setLoopingSentenceId] = useState<string | null>(
    null,
  );
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  // Height of the transcript viewport. Used as the content bottom padding so
  // even the last sentence can be scrolled all the way to the top.
  const [scriptViewportHeight, setScriptViewportHeight] = useState(0);

  const playerRef = useRef<YouTubePlayerHandle>(null);
  // Plain ScrollView (see file header for why not FlatList). scrollTo() drives
  // the active line to the top.
  const scrollRef = useRef<ScrollView>(null);
  // Measured top offset (within the scroll content) of each sentence row,
  // keyed by sentence id. Repopulated on every layout pass (translation toggle,
  // session change) so scrollTo always targets the row's real position.
  const sentenceYRef = useRef<Record<string, number>>({});
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const activeSessionIdRef = useRef(session.id);
  const isCardActiveRef = useRef(isActive);
  const pendingSentenceRef = useRef<Sentence | null>(null);
  // Distinct from pendingSentenceRef (used by loop's playSentence): tap and
  // nav use jumpToSentence which has session-remaining playback semantics, so
  // queueing must remember which kind of pending action to drain when the
  // player becomes ready.
  const pendingJumpSentenceRef = useRef<Sentence | null>(null);
  const pendingAutoplayRef = useRef(false);
  const loopingSentenceIdRef = useRef<string | null>(null);
  const hasTrackedImpressionRef = useRef(false);
  const activeSentenceIdRef = useRef<string | null>(null);
  const handledNavigationNonceRef = useRef<number | null>(null);
  const onSessionEndRef = useRef(onSessionEnd);
  const sessionEndFiredRef = useRef(false);
  // Blocks polling-driven activeSentenceId writes while a manual seek settles
  // (currentTime is briefly still in the previous sentence's range after seekTo).
  const seekLockRef = useRef(false);
  const seekLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const acquireSeekLock = useCallback((durationMs: number = 800) => {
    if (seekLockTimeoutRef.current) clearTimeout(seekLockTimeoutRef.current);
    seekLockRef.current = true;
    seekLockTimeoutRef.current = setTimeout(() => {
      seekLockRef.current = false;
      seekLockTimeoutRef.current = null;
    }, durationMs);
  }, []);

  const releaseSeekLock = useCallback(() => {
    if (seekLockTimeoutRef.current) {
      clearTimeout(seekLockTimeoutRef.current);
      seekLockTimeoutRef.current = null;
    }
    seekLockRef.current = false;
  }, []);

  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // Scroll the active sentence to the TOP of the transcript viewport. Uses the
  // measured row offset; if the row hasn't been measured yet, this is a no-op
  // and handleSentenceLayout will scroll once its onLayout fires. We do not gate
  // on seekLock: when the active sentence changes (tap/jump/polling) we always
  // want the list to follow it.
  const scrollActiveSentenceToTop = useCallback(
    (sentenceId: string | null, animated: boolean) => {
      if (!sentenceId) return;
      const y = sentenceYRef.current[sentenceId];
      if (typeof y !== "number") return;
      scrollRef.current?.scrollTo({ y: Math.max(y, 0), animated });
    },
    [],
  );

  const resetScriptScrollPosition = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const syncActiveSentence = useCallback(async () => {
    if (!video || !playerReady || sentences.length === 0) return;
    // Block polling while a manual seek (tap/nav) is settling — otherwise
    // polling reads currentTime that is briefly still in the previous
    // sentence's range and overwrites the user-selected sentence.
    if (seekLockRef.current) return;
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

    // Detect session end via polling for precise sync
    if (
      currentTime >= sessionEndSeconds - 0.15 &&
      !sessionEndFiredRef.current
    ) {
      sessionEndFiredRef.current = true;
      clearPlaybackTimeout();
      clearProgressInterval();
      setPlaying(false);
      onSessionEndRef.current?.();
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
  }, [
    clearPlaybackTimeout,
    clearProgressInterval,
    playerReady,
    sentences,
    sessionEndSeconds,
    video,
  ]);

  const stopPlayback = useCallback(() => {
    clearPlaybackTimeout();
    clearProgressInterval();
    setPlaying(false);
  }, [clearPlaybackTimeout, clearProgressInterval]);

  const startSessionPlayback = useCallback(() => {
    if (!video) return;

    clearPlaybackTimeout();
    setLoopingSentenceId(null);

    // Optimistic highlight: surface the first sentence immediately so the user
    // sees feedback before the 100ms polling loop catches up. Polling will
    // refine this within one tick.
    const firstSentence = sentences[0];
    if (firstSentence) {
      setActiveSentenceId(firstSentence.id);
    }

    if (!playerReady) {
      pendingAutoplayRef.current = true;
      setPlaying(true);
      return;
    }

    pendingAutoplayRef.current = false;
    acquireSeekLock();
    playerRef.current?.seekTo(sessionStartSeconds, true);
    setPlaying(true);

    const durationMs = Math.max(
      (sessionEndSeconds - sessionStartSeconds) * 1000,
      1000,
    );
    stopTimeoutRef.current = setTimeout(() => {
      setPlaying(false);
      if (!sessionEndFiredRef.current) {
        sessionEndFiredRef.current = true;
        onSessionEndRef.current?.();
      }
    }, durationMs);
  }, [
    acquireSeekLock,
    clearPlaybackTimeout,
    playerReady,
    sentences,
    sessionEndSeconds,
    sessionStartSeconds,
    video,
  ]);

  /**
   * Jump-and-continue: seeks to the given sentence's start time and continues
   * playback through to the end of the session (NOT just the sentence). Used
   * by sentence tap and the prev/next navigation arrows. The session-end
   * timeout is rescheduled from the new playhead so onSessionEnd still fires
   * at the correct time.
   */
  const jumpToSentence = useCallback(
    (sentence: Sentence) => {
      if (!playerReady || !video) {
        pendingJumpSentenceRef.current = sentence;
        return;
      }

      clearPlaybackTimeout();
      const seekSeconds = (video.snippet_start_time ?? 0) + sentence.startTime;
      const remainingMs = Math.max(
        (sessionEndSeconds - seekSeconds) * 1000,
        1000,
      );

      pendingSentenceRef.current = null;
      pendingJumpSentenceRef.current = null;
      pendingAutoplayRef.current = false;
      setLoopingSentenceId(null);
      setActiveSentenceId(sentence.id);
      setPlaying(true);
      acquireSeekLock();
      playerRef.current?.seekTo(seekSeconds, true);

      stopTimeoutRef.current = setTimeout(() => {
        setPlaying(false);
        if (!sessionEndFiredRef.current) {
          sessionEndFiredRef.current = true;
          onSessionEndRef.current?.();
        }
      }, remainingMs);
    },
    [
      acquireSeekLock,
      clearPlaybackTimeout,
      playerReady,
      sessionEndSeconds,
      video,
    ],
  );

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
      acquireSeekLock();
      playerRef.current?.seekTo(seekSeconds, true);

      stopTimeoutRef.current = setTimeout(() => {
        if (loopingSentenceIdRef.current === sentence.id) {
          playSentence(sentence);
          return;
        }

        setPlaying(false);
      }, durationMs);
    },
    [acquireSeekLock, clearPlaybackTimeout, playerReady, video],
  );

  useEffect(() => {
    onSessionEndRef.current = onSessionEnd;
  }, [onSessionEnd]);

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
    // Reset transcript scroll on every active/inactive transition so the new
    // session's script starts at the top regardless of where the previous
    // session was scrolled.
    resetScriptScrollPosition();

    if (!isActive) {
      pendingSentenceRef.current = null;
      pendingJumpSentenceRef.current = null;
      pendingAutoplayRef.current = false;
      releaseSeekLock();
      setLoopingSentenceId(null);
      setActiveSentenceId(null);
      stopPlayback();
    }
  }, [isActive, releaseSeekLock, resetScriptScrollPosition, stopPlayback]);

  useEffect(() => {
    setPlayerReady(false);
    setPlaying(false);
    hasTrackedImpressionRef.current = false;
    handledNavigationNonceRef.current = null;
    sessionEndFiredRef.current = false;
    // New session/video → previously measured row offsets are stale.
    sentenceYRef.current = {};
    resetScriptScrollPosition();
    setLoopingSentenceId(null);
    setActiveSentenceId(null);
  }, [resetScriptScrollPosition, session.id, video?.video_id]);

  useEffect(() => {
    // Translation toggle changes row heights → previously measured offsets are
    // stale. Clear them; onLayout will repopulate and re-scroll to the active
    // row (handleSentenceLayout), and the effect below re-fires on showTranslation.
    sentenceYRef.current = {};
  }, [showTranslation]);

  useEffect(() => {
    if (!scriptVisible) {
      resetScriptScrollPosition();
    }
  }, [resetScriptScrollPosition, scriptVisible]);

  // Stable ref to startSessionPlayback so the activation effect below does not
  // re-fire whenever the callback identity changes (playerReady, sessionStart/End,
  // sentences, video — any of these recreate the callback). Without this guard,
  // a single activation could trigger multiple seeks and blank the highlight
  // mid-flight.
  const startSessionPlaybackRef = useRef(startSessionPlayback);
  useEffect(() => {
    startSessionPlaybackRef.current = startSessionPlayback;
  }, [startSessionPlayback]);

  useEffect(() => {
    if (!isActive || !video) return;
    startSessionPlaybackRef.current();
  }, [isActive, video?.video_id]);

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

    // Latest user intent wins: a queued tap/nav (jump-and-continue) takes
    // precedence over a queued autoplay or loop preview.
    if (pendingJumpSentenceRef.current) {
      const sentence = pendingJumpSentenceRef.current;
      pendingJumpSentenceRef.current = null;
      pendingSentenceRef.current = null;
      pendingAutoplayRef.current = false;
      jumpToSentence(sentence);
      return;
    }

    if (pendingSentenceRef.current) {
      const sentence = pendingSentenceRef.current;
      pendingSentenceRef.current = null;
      pendingAutoplayRef.current = false;
      playSentence(sentence);
      return;
    }

    if (pendingAutoplayRef.current) {
      pendingAutoplayRef.current = false;
      acquireSeekLock();
      playerRef.current?.seekTo(sessionStartSeconds, true);
      setPlaying(true);
      const durationMs = Math.max(
        (sessionEndSeconds - sessionStartSeconds) * 1000,
        1000,
      );
      stopTimeoutRef.current = setTimeout(() => {
        setPlaying(false);
        if (!sessionEndFiredRef.current) {
          sessionEndFiredRef.current = true;
          onSessionEndRef.current?.();
        }
      }, durationMs);
    }
  }, [
    acquireSeekLock,
    isActive,
    jumpToSentence,
    playSentence,
    playerReady,
    sessionEndSeconds,
    sessionStartSeconds,
  ]);

  useEffect(() => {
    return () => {
      clearPlaybackTimeout();
      clearProgressInterval();
      if (seekLockTimeoutRef.current) clearTimeout(seekLockTimeoutRef.current);
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
    // 100ms matches the regular study tab's polling cadence so the active-line
    // highlight and auto-scroll follow the audio without the ~250ms lag that
    // made shorts sync feel unstable.
    progressIntervalRef.current = setInterval(() => {
      void syncActiveSentence();
    }, 100);

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
      // Tap a sentence → seek there and continue session playback (TikTok/Reels
      // style). Use playSentence only for loop semantics (handleLoopToggle).
      // REQ-019-P3-02: fire-and-forget selection haptic before seek.
      safeSelectionAsync();
      jumpToSentence(sentence);
    },
    [jumpToSentence],
  );

  const handleScriptViewportLayout = useCallback((event: LayoutChangeEvent) => {
    setScriptViewportHeight(event.nativeEvent.layout.height);
  }, []);

  const handleSentenceLayout = useCallback(
    (sentenceId: string, event: LayoutChangeEvent) => {
      sentenceYRef.current[sentenceId] = event.nativeEvent.layout.y;
      // When the active sentence's real position arrives (initial layout, or a
      // height change from the translation toggle), scroll to it now. This is
      // the fix for the old bug where a one-shot align ran before measurement
      // and was never corrected — so the active line never rose to the top.
      if (
        sentenceId === activeSentenceIdRef.current &&
        isCardActiveRef.current &&
        scriptVisible
      ) {
        scrollActiveSentenceToTop(sentenceId, true);
      }
    },
    [scriptVisible, scrollActiveSentenceToTop],
  );

  // Follow the active sentence: scroll it to the top whenever it changes, or
  // when the translation toggle alters row heights. requestAnimationFrame lets
  // the new layout settle before we read the measured offset.
  useEffect(() => {
    if (!isActive || !scriptVisible || !activeSentenceId) return;

    const frame = requestAnimationFrame(() => {
      scrollActiveSentenceToTop(activeSentenceId, true);
    });

    return () => cancelAnimationFrame(frame);
  }, [
    activeSentenceId,
    isActive,
    scriptVisible,
    scrollActiveSentenceToTop,
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
      // Prev/next nav arrows → seek and continue playback through the rest of
      // the session (so the auto-scroll keeps following the playhead).
      jumpToSentence(nextSentence);
    }
  }, [isActive, jumpToSentence, navigationRequest, sentences]);

  const handleLoopToggle = useCallback(
    (sentence: Sentence) => {
      // REQ-019-P3-03: Light impact haptic on loop toggle (fire-and-forget).
      safeImpactAsync(ImpactFeedbackStyle.Light);
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
      // REQ-019-P3-04: Light impact haptic on sentence save toggle (fire-and-forget).
      safeImpactAsync(ImpactFeedbackStyle.Light);
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
        {!scriptVisible ? (
          <View style={styles.scriptHiddenState}>
            <Text style={styles.scriptHiddenTitle}>자막이 숨겨져 있어요</Text>
            <Text style={styles.scriptHiddenSubtitle}>
              처음에는 자막 없이 끝까지 들어보세요. 너무 어렵거나 하나도 들리지
              않는다면 난이도가 더 쉬운 영상으로 먼저 공부하세요.
            </Text>
          </View>
        ) : sentences.length > 0 ? (
          <ScrollView
            ref={scrollRef}
            style={styles.scriptList}
            contentContainerStyle={[
              styles.scriptContent,
              {
                // Bottom padding ≈ viewport height so even the last sentence can
                // be scrolled all the way to the top.
                paddingBottom:
                  Math.max(scriptViewportHeight, spacing.xl) +
                  bottomOverlayInset,
              },
            ]}
            // Programmatic-scroll only: the vertical shorts pager owns swipe
            // gestures, so the transcript must not capture pan. scrollTo() still
            // works with scrollEnabled=false on both iOS and Android.
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          >
            {sentences.map((sentence) => (
              <View
                key={sentence.id}
                onLayout={(event) => handleSentenceLayout(sentence.id, event)}
              >
                <ScriptLine
                  sentence={sentence}
                  isActive={activeSentenceId === sentence.id}
                  isLooping={loopingSentenceId === sentence.id}
                  isSaved={savedSentences.some(
                    (saved) =>
                      saved.sentenceId === sentence.id &&
                      saved.videoId === session.source_video_id,
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
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.placeholderText}>자막을 준비하는 중이에요.</Text>
        )}
      </View>
    </View>
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
  scriptList: {
    flex: 1,
  },
  scriptContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  scriptHiddenState: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    minHeight: 160,
    gap: spacing.sm,
  },
  scriptHiddenTitle: {
    fontSize: font.size.base,
    fontWeight: font.weight.semibold,
    color: colors.textOnDarkMuted,
    letterSpacing: font.tracking.normal,
  },
  scriptHiddenSubtitle: {
    fontSize: font.size.sm,
    color: colors.textOnDarkMuted,
    lineHeight: leading(font.size.sm, font.lineHeight.relaxed),
    letterSpacing: font.tracking.normal,
    opacity: 0.7,
  },
});
