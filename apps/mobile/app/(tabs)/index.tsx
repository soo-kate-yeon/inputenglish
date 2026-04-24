import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  LayoutChangeEvent,
  LayoutAnimation,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { CuratedVideo } from "@inputenglish/shared";
import type { SessionListItem } from "@/lib/api";
import {
  fetchCuratedVideo,
  fetchLearningSessionsPaginated,
  fetchSessionsByIds,
} from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useSubscription } from "@/hooks/useSubscription";
import SentenceNavigationBar from "@/components/common/SentenceNavigationBar";
import ShortSessionCard from "@/components/shorts/ShortSessionCard";
import { useAuth } from "@/contexts/AuthContext";
import { getRecentSessionIds, recordSessionVisit } from "@/lib/recent-sessions";
import {
  getLongformPressDestination,
  getSessionPressDestination,
} from "@/lib/session-access";
import {
  getSavedShortSessionIds,
  toggleSavedShortSession,
} from "@/lib/saved-shorts";
import {
  findSentenceIndex,
  resolveSentencesByIdsOrRange,
} from "@/lib/transcript-navigation";
import {
  getVideoCache,
  setVideoCache as persistVideoCache,
} from "@/lib/video-cache";
import { colors, font, radius, spacing } from "@/theme";

type FeedMode = "recommended" | "saved";
type VideoLoadState = {
  status: "idle" | "loading" | "loaded" | "error";
  error?: string | null;
};

const FALLBACK_VIEWPORT_HEIGHT = 720;
const SHORTS_OVERLAY_HEIGHT = 220;
const SHORTS_SCRIPT_TOP_INSET = 52;
const SHORTS_SCRIPT_BOTTOM_INSET = 112;
function scoreSession(
  session: SessionListItem,
  options: {
    preferredSituations: string[];
    preferredCategories: string[];
    preferredSpeakers: string[];
  },
): number {
  let score = 0;

  if (session.source_type === "podcast") score += 4;
  if (session.source_type === "interview") score += 3;
  if (session.source_type === "panel") score += 2;

  if (
    session.speaking_situations?.some((item) =>
      options.preferredSituations.includes(item),
    )
  ) {
    score += 3;
  }

  if (
    session.video_categories?.some((item) =>
      options.preferredCategories.includes(item),
    )
  ) {
    score += 2;
  }

  if (
    session.speaker_names?.some((item) =>
      options.preferredSpeakers.includes(item),
    )
  ) {
    score += 2;
  }

  return score;
}

function sortRecommendedSessions(
  sessions: SessionListItem[],
  options: {
    preferredSituations: string[];
    preferredCategories: string[];
    preferredSpeakers: string[];
  },
): SessionListItem[] {
  return [...sessions].sort((left, right) => {
    const scoreDifference =
      scoreSession(right, options) - scoreSession(left, options);
    if (scoreDifference !== 0) return scoreDifference;
    return left.order_index - right.order_index;
  });
}

function getEmptyStateCopy(mode: FeedMode): {
  title: string;
  body: string;
} {
  switch (mode) {
    case "saved":
      return {
        title: "저장한 쇼츠가 아직 없어요",
        body: "흥미로운 구간을 저장해두면 출퇴근 시간에 바로 다시 볼 수 있어요.",
      };
    default:
      return {
        title: "지금 볼 쇼츠를 준비하지 못했어요",
        body: "잠시 후 다시 시도하거나 탐색 탭에서 세션을 둘러봐 주세요.",
      };
  }
}

export default function HomeScreen() {
  const { learningProfile, isProfileLoading } = useAuth();
  const { plan } = useSubscription();
  const { width: windowWidth } = useWindowDimensions();

  const [viewportHeight, setViewportHeight] = useState(
    FALLBACK_VIEWPORT_HEIGHT,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedMode, setFeedMode] = useState<FeedMode>("recommended");
  const [recommendedSessions, setRecommendedSessions] = useState<
    SessionListItem[]
  >([]);
  const [savedSessions, setSavedSessions] = useState<SessionListItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionListItem[]>([]);
  const [savedSessionIds, setSavedSessionIds] = useState<string[]>([]);
  const [recentSessionIds, setRecentSessionIds] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [scriptVisible, setScriptVisible] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [sentenceNavigationRequest, setSentenceNavigationRequest] = useState<{
    direction: "prev" | "next";
    nonce: number;
  } | null>(null);
  const [videoCache, setVideoCache] = useState<Record<string, CuratedVideo>>(
    {},
  );
  const [videoLoadState, setVideoLoadState] = useState<
    Record<string, VideoLoadState>
  >({});

  const flatListRef = useRef<FlatList<SessionListItem>>(null);
  const lastRecordedSessionIdRef = useRef<string | null>(null);
  const activeIndexRef = useRef(0);
  const currentFeedLengthRef = useRef(0);
  const cachedVideosRef = useRef<Record<string, CuratedVideo>>({});
  const videoLoadStateRef = useRef<Record<string, VideoLoadState>>({});
  const inFlightVideoRequestsRef = useRef<
    Partial<Record<string, Promise<CuratedVideo | null>>>
  >({});
  const sentenceNavigationNonceRef = useRef(0);

  const preferredSituations = useMemo(
    () => learningProfile?.preferred_situations ?? [],
    [learningProfile?.preferred_situations],
  );
  const preferredCategories = useMemo(
    () => learningProfile?.preferred_video_categories ?? [],
    [learningProfile?.preferred_video_categories],
  );
  const preferredSpeakers = useMemo(
    () => learningProfile?.preferred_speakers ?? [],
    [learningProfile?.preferred_speakers],
  );

  const ensureVideoLoaded = useCallback(async (videoId: string) => {
    if (!videoId) return null;

    // 1. In-memory cache
    if (cachedVideosRef.current[videoId]) {
      return cachedVideosRef.current[videoId];
    }

    // 2. MMKV persistent cache (instant, no network)
    const persisted = getVideoCache(videoId);
    if (persisted) {
      cachedVideosRef.current[videoId] = persisted;
      videoLoadStateRef.current[videoId] = { status: "loaded", error: null };
      setVideoCache((current) =>
        current[videoId] ? current : { ...current, [videoId]: persisted },
      );
      setVideoLoadState((current) => ({
        ...current,
        [videoId]: { status: "loaded", error: null },
      }));
      return persisted;
    }

    // 3. In-flight dedup
    if (inFlightVideoRequestsRef.current[videoId]) {
      return inFlightVideoRequestsRef.current[videoId];
    }

    videoLoadStateRef.current[videoId] = { status: "loading", error: null };
    setVideoLoadState((current) => ({
      ...current,
      [videoId]: { status: "loading", error: null },
    }));

    const request = fetchCuratedVideo(videoId)
      .then((video) => {
        cachedVideosRef.current[videoId] = video;
        videoLoadStateRef.current[videoId] = {
          status: "loaded",
          error: null,
        };
        setVideoCache((current) =>
          current[videoId] ? current : { ...current, [videoId]: video },
        );
        setVideoLoadState((current) => ({
          ...current,
          [videoId]: { status: "loaded", error: null },
        }));
        persistVideoCache(videoId, video);
        return video;
      })
      .catch((nextError: Error) => {
        const message = nextError?.message ?? "세션 영상을 불러오지 못했어요.";
        videoLoadStateRef.current[videoId] = {
          status: "error",
          error: message,
        };
        setVideoLoadState((current) => ({
          ...current,
          [videoId]: { status: "error", error: message },
        }));
        return null;
      })
      .finally(() => {
        delete inFlightVideoRequestsRef.current[videoId];
      });

    inFlightVideoRequestsRef.current[videoId] = request;
    return request;
  }, []);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const savedIds = getSavedShortSessionIds();
      const recentIds = getRecentSessionIds();

      const [feedResult, savedResult, recentResult] = await Promise.all([
        fetchLearningSessionsPaginated(0),
        savedIds.length > 0
          ? fetchSessionsByIds(savedIds)
          : Promise.resolve([]),
        recentIds.length > 0
          ? fetchSessionsByIds(recentIds)
          : Promise.resolve([]),
      ]);

      const sortedRecommended = sortRecommendedSessions(feedResult.sessions, {
        preferredSituations,
        preferredCategories,
        preferredSpeakers,
      });

      setRecommendedSessions(sortedRecommended);
      setSavedSessionIds(savedIds);
      setRecentSessionIds(recentIds);
      setSavedSessions(savedResult);
      setRecentSessions(recentResult);

      const initialPrimeSessions = [
        ...sortedRecommended.slice(0, 3),
        ...savedResult.slice(0, 2),
        ...recentResult.slice(0, 2),
      ];

      for (const session of initialPrimeSessions) {
        void ensureVideoLoaded(session.source_video_id);
      }
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : "쇼츠 피드를 불러오지 못했어요.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [
    ensureVideoLoaded,
    preferredCategories,
    preferredSpeakers,
    preferredSituations,
  ]);

  useFocusEffect(
    useCallback(() => {
      void loadSessions();
    }, [loadSessions]),
  );

  const currentFeed = useMemo(() => {
    switch (feedMode) {
      case "saved":
        return savedSessions;
      default:
        return recommendedSessions;
    }
  }, [feedMode, recommendedSessions, savedSessions]);

  const updateActiveIndex = useCallback((nextIndex: number) => {
    const clampedIndex = Math.max(
      0,
      Math.min(nextIndex, currentFeedLengthRef.current - 1),
    );
    if (!Number.isFinite(clampedIndex)) return;
    if (clampedIndex !== activeIndexRef.current) {
      activeIndexRef.current = clampedIndex;
      setActiveIndex(clampedIndex);
    }
  }, []);

  const activeSession = currentFeed[activeIndex] ?? null;
  const activeSessionSentences = useMemo(() => {
    if (!activeSession) return [];

    return resolveSentencesByIdsOrRange(
      videoCache[activeSession.source_video_id]?.transcript ?? [],
      activeSession.sentence_ids,
      activeSession.start_time,
      activeSession.end_time,
    );
  }, [activeSession, videoCache]);
  const activeSentenceIndex = useMemo(
    () => findSentenceIndex(activeSessionSentences, activeSentenceId),
    [activeSentenceId, activeSessionSentences],
  );
  const hasPrevSentence = activeSentenceIndex > 0;
  const hasNextSentence =
    activeSentenceIndex >= 0
      ? activeSentenceIndex < activeSessionSentences.length - 1
      : activeSessionSentences.length > 0;
  const isActiveSessionSaved = activeSession
    ? savedSessionIds.includes(activeSession.id)
    : false;
  const activeSessionDescription = activeSession
    ? activeSession.expected_takeaway ||
      activeSession.description ||
      [activeSession.primary_speaker_name, activeSession.channel_name]
        .filter(Boolean)
        .join(" · ")
    : "";
  const shortsPlayerHeight = Math.round(
    (windowWidth - spacing.md * 2) * (9 / 16),
  );

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    currentFeedLengthRef.current = currentFeed.length;
  }, [currentFeed.length]);

  useEffect(() => {
    setActiveIndex(0);
    activeIndexRef.current = 0;
    flatListRef.current?.scrollToOffset({ animated: false, offset: 0 });
  }, [feedMode]);

  useEffect(() => {
    if (activeIndex >= currentFeed.length) {
      updateActiveIndex(0);
      flatListRef.current?.scrollToOffset({ animated: false, offset: 0 });
    }
  }, [activeIndex, currentFeed.length, updateActiveIndex]);

  useEffect(() => {
    setIsDescriptionExpanded(false);
    setActiveSentenceId(null);
    setSentenceNavigationRequest(null);
  }, [activeSession?.id]);

  useEffect(() => {
    const nearbySessions = [
      currentFeed[activeIndex - 1],
      currentFeed[activeIndex],
      currentFeed[activeIndex + 1],
    ].filter((session): session is SessionListItem => Boolean(session));

    for (const session of nearbySessions) {
      void ensureVideoLoaded(session.source_video_id);
    }
  }, [activeIndex, currentFeed, ensureVideoLoaded]);

  useEffect(() => {
    if (!activeSession) return;
    if (lastRecordedSessionIdRef.current === activeSession.id) return;

    lastRecordedSessionIdRef.current = activeSession.id;
    recordSessionVisit(activeSession.id, activeSession.source_video_id);
    setRecentSessionIds((current) => [
      activeSession.id,
      ...current.filter((item) => item !== activeSession.id),
    ]);
    setRecentSessions((current) => [
      activeSession,
      ...current.filter((item) => item.id !== activeSession.id),
    ]);
  }, [activeSession]);

  const handleFeedLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = Math.round(event.nativeEvent.layout.height);
      if (nextHeight > 0 && nextHeight !== viewportHeight) {
        setViewportHeight(nextHeight);
      }
    },
    [viewportHeight],
  );

  const handleMomentumScrollEnd = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      if (viewportHeight <= 0) return;
      const nextIndex = Math.round(
        event.nativeEvent.contentOffset.y / viewportHeight,
      );
      updateActiveIndex(nextIndex);
    },
    [updateActiveIndex, viewportHeight],
  );

  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 80,
  });

  const handleViewableItemsChangedRef = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: Array<ViewToken<SessionListItem>>;
    }) => {
      const firstFullyVisibleItem = viewableItems.find(
        (item) => item.isViewable && typeof item.index === "number",
      );

      if (typeof firstFullyVisibleItem?.index === "number") {
        updateActiveIndex(firstFullyVisibleItem.index);
      }
    },
  );

  const handleToggleShortSave = useCallback((session: SessionListItem) => {
    const result = toggleSavedShortSession(session.id, session.source_video_id);
    const nextIds = result.entries.map((entry) => entry.sessionId);

    setSavedSessionIds(nextIds);
    setSavedSessions((current) => {
      if (result.saved) {
        return [session, ...current.filter((item) => item.id !== session.id)];
      }

      return current.filter((item) => item.id !== session.id);
    });

    trackEvent(result.saved ? "short_session_saved" : "short_session_unsaved", {
      sessionId: session.id,
      videoId: session.source_video_id,
      sourceType: session.source_type ?? "unknown",
    });
  }, []);

  const handleToggleActiveShortSave = useCallback(() => {
    if (!activeSession) return;
    handleToggleShortSave(activeSession);
  }, [activeSession, handleToggleShortSave]);

  const handleOpenLongSession = useCallback(() => {
    if (!activeSession) return;

    trackEvent("shorts_to_long_session_opened", {
      sessionId: activeSession.id,
      videoId: activeSession.source_video_id,
      strategy: activeSession.longform_pack_id
        ? "longform_pack"
        : "current_session_fallback",
    });
    if (!activeSession.longform_pack_id) {
      trackEvent("shorts_long_session_fallback_used", {
        sessionId: activeSession.id,
        videoId: activeSession.source_video_id,
      });
    }
    router.push(getLongformPressDestination(activeSession, plan));
  }, [activeSession, plan]);

  const handleNavigateActiveSentence = useCallback(
    (direction: "prev" | "next") => {
      if (!activeSession) return;
      if (direction === "prev" && !hasPrevSentence) return;
      if (direction === "next" && !hasNextSentence) return;

      sentenceNavigationNonceRef.current += 1;
      setSentenceNavigationRequest({
        direction,
        nonce: sentenceNavigationNonceRef.current,
      });
    },
    [activeSession, hasNextSentence, hasPrevSentence],
  );

  const handleToggleFeedMode = useCallback((nextMode: FeedMode) => {
    setFeedMode(nextMode);
  }, []);

  const renderFeedItem = useCallback(
    ({ item, index }: { item: SessionListItem; index: number }) => (
      <View style={[styles.feedPage, { height: viewportHeight }]}>
        <ShortSessionCard
          session={item}
          isActive={index === activeIndex}
          shouldLoad={Math.abs(index - activeIndex) <= 1}
          scriptVisible={scriptVisible}
          showTranslation={showTranslation}
          topOverlayInset={SHORTS_SCRIPT_TOP_INSET}
          bottomOverlayInset={SHORTS_SCRIPT_BOTTOM_INSET}
          video={videoCache[item.source_video_id] ?? null}
          videoState={
            videoLoadState[item.source_video_id] ?? {
              status: "idle",
              error: null,
            }
          }
          onRetryVideoLoad={ensureVideoLoaded}
          navigationRequest={
            index === activeIndex ? sentenceNavigationRequest : null
          }
          onActiveSentenceChange={
            index === activeIndex
              ? (sentenceId) => {
                  setActiveSentenceId(sentenceId);
                }
              : undefined
          }
        />
      </View>
    ),
    [
      activeIndex,
      ensureVideoLoaded,
      sentenceNavigationRequest,
      scriptVisible,
      showTranslation,
      videoCache,
      videoLoadState,
      viewportHeight,
    ],
  );

  if (isProfileLoading || isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>쇼츠 피드를 준비하고 있어요…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!learningProfile?.goal_mode) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.screenContent}>
          <View style={styles.titleTabs}>
            <Text style={[styles.titleTabText, styles.titleTabTextActive]}>
              쇼츠
            </Text>
            <Text style={styles.titleTabText}>저장됨</Text>
          </View>
          <Text style={styles.screenSubtitle}>
            학습 모드를 먼저 정하면 더 취향에 맞는 쇼츠를 보여드릴 수 있어요.
          </Text>
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>학습 설정이 아직 없어요</Text>
            <Text style={styles.stateBody}>
              발음 훔치기인지, 표현 훔치기인지에 따라 먼저 보여드릴 세션이
              달라져요.
            </Text>
            <Pressable
              style={styles.primaryCta}
              onPress={() => router.push("/onboarding?edit=1" as never)}
            >
              <Text style={styles.primaryCtaText}>학습 설정 열기</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.screenContent}>
          <View style={styles.titleTabs}>
            <Text style={[styles.titleTabText, styles.titleTabTextActive]}>
              쇼츠
            </Text>
            <Text style={styles.titleTabText}>저장됨</Text>
          </View>
          <Text style={styles.screenSubtitle}>{error}</Text>
          <View style={styles.stateCard}>
            <Pressable
              style={styles.primaryCta}
              onPress={() => void loadSessions()}
            >
              <Text style={styles.primaryCtaText}>다시 시도</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (currentFeed.length === 0) {
    const copy = getEmptyStateCopy(feedMode);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.screenContent}>
          <View style={styles.titleTabs}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="쇼츠 보기"
              onPress={() => handleToggleFeedMode("recommended")}
            >
              <Text
                style={[
                  styles.titleTabText,
                  feedMode === "recommended" && styles.titleTabTextActive,
                ]}
              >
                쇼츠
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="저장된 쇼츠 보기"
              onPress={() => handleToggleFeedMode("saved")}
            >
              <Text
                style={[
                  styles.titleTabText,
                  feedMode === "saved" && styles.titleTabTextActive,
                ]}
              >
                저장됨
              </Text>
            </Pressable>
          </View>
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>{copy.title}</Text>
            <Text style={styles.stateBody}>{copy.body}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenContent}>
        <View style={styles.topHeader}>
          <View style={styles.titleTabs}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="쇼츠 보기"
              onPress={() => handleToggleFeedMode("recommended")}
            >
              <Text
                style={[
                  styles.titleTabText,
                  feedMode === "recommended" && styles.titleTabTextActive,
                ]}
              >
                쇼츠
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="저장된 쇼츠 보기"
              onPress={() => handleToggleFeedMode("saved")}
            >
              <Text
                style={[
                  styles.titleTabText,
                  feedMode === "saved" && styles.titleTabTextActive,
                ]}
              >
                저장됨
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.feedViewport} onLayout={handleFeedLayout}>
          <FlatList
            ref={flatListRef}
            data={currentFeed}
            keyExtractor={(item) => item.id}
            renderItem={renderFeedItem}
            extraData={`${activeIndex}:${scriptVisible}:${showTranslation}:${viewportHeight}:${sentenceNavigationRequest?.nonce ?? 0}`}
            pagingEnabled
            disableIntervalMomentum
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            onViewableItemsChanged={handleViewableItemsChangedRef.current}
            viewabilityConfig={viewabilityConfigRef.current}
            getItemLayout={(_, index) => ({
              length: viewportHeight,
              offset: viewportHeight * index,
              index,
            })}
            windowSize={3}
            initialNumToRender={2}
            maxToRenderPerBatch={3}
            removeClippedSubviews={false}
          />
          {activeSession ? (
            <View pointerEvents="box-none" style={styles.activeSessionOverlay}>
              <View
                pointerEvents="box-none"
                style={[
                  styles.sentenceNavWrapper,
                  { top: shortsPlayerHeight + spacing.xs },
                ]}
              >
                <SentenceNavigationBar
                  tone="dark"
                  hasPrev={hasPrevSentence}
                  hasNext={hasNextSentence}
                  onPrev={() => handleNavigateActiveSentence("prev")}
                  onNext={() => handleNavigateActiveSentence("next")}
                />
              </View>
              <LinearGradient
                colors={[
                  "rgba(5,7,12,0)",
                  "rgba(5,7,12,0.34)",
                  "rgba(5,7,12,0.82)",
                  "rgba(5,7,12,0.96)",
                  "rgba(5,7,12,1)",
                ]}
                locations={[0, 0.24, 0.6, 1]}
                style={styles.activeSessionGradient}
                pointerEvents="none"
              />
              <View style={styles.activeSessionOverlayContent}>
                <View style={styles.activeSessionMetaRow}>
                  <View style={styles.activeSessionCopy}>
                    <View style={styles.activeSessionTitleRow}>
                      <Text style={styles.activeSessionTitle} numberOfLines={2}>
                        {activeSession.title}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${activeSession.title} 설명 ${
                        isDescriptionExpanded ? "접기" : "펼치기"
                      }`}
                      onPress={() => {
                        LayoutAnimation.configureNext(
                          LayoutAnimation.Presets.easeInEaseOut,
                        );
                        setIsDescriptionExpanded((current) => !current);
                      }}
                    >
                      <Text
                        style={styles.activeSessionDescription}
                        numberOfLines={isDescriptionExpanded ? undefined : 2}
                      >
                        {activeSessionDescription}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.activeSessionActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${activeSession.title} 쇼츠 저장`}
                      style={styles.actionItem}
                      onPress={handleToggleActiveShortSave}
                    >
                      <View
                        style={[
                          styles.iconButton,
                          isActiveSessionSaved && styles.iconButtonActive,
                        ]}
                      >
                        <Ionicons
                          name={
                            isActiveSessionSaved
                              ? "bookmark"
                              : "bookmark-outline"
                          }
                          size={18}
                          color={
                            isActiveSessionSaved
                              ? colors.bgDark
                              : colors.textOnDark
                          }
                        />
                      </View>
                      <Text
                        style={[
                          styles.actionLabel,
                          isActiveSessionSaved && styles.actionLabelActive,
                        ]}
                      >
                        저장
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="스크립트 토글"
                      style={styles.actionItem}
                      onPress={() => setScriptVisible((current) => !current)}
                    >
                      <View
                        style={[
                          styles.iconButton,
                          scriptVisible && styles.iconButtonActive,
                        ]}
                      >
                        <Ionicons
                          name={
                            scriptVisible
                              ? "chatbox-ellipses"
                              : "chatbox-ellipses-outline"
                          }
                          size={18}
                          color={
                            scriptVisible ? colors.bgDark : colors.textOnDark
                          }
                        />
                      </View>
                      <Text
                        style={[
                          styles.actionLabel,
                          scriptVisible && styles.actionLabelActive,
                        ]}
                      >
                        스크립트
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="번역 토글"
                      style={styles.actionItem}
                      onPress={() => setShowTranslation((current) => !current)}
                    >
                      <View
                        style={[
                          styles.iconButton,
                          showTranslation && styles.iconButtonActive,
                        ]}
                      >
                        <Ionicons
                          name={showTranslation ? "globe" : "globe-outline"}
                          size={18}
                          color={
                            showTranslation ? colors.bgDark : colors.textOnDark
                          }
                        />
                      </View>
                      <Text
                        style={[
                          styles.actionLabel,
                          showTranslation && styles.actionLabelActive,
                        ]}
                      >
                        번역
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${activeSession.title} 더 공부하기`}
                      style={styles.actionItem}
                      onPress={handleOpenLongSession}
                    >
                      <View style={styles.iconButton}>
                        <Ionicons
                          name="arrow-forward"
                          size={18}
                          color={colors.textOnDark}
                        />
                      </View>
                      <Text style={styles.actionLabel}>더 공부하기</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  screenContent: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.md,
    backgroundColor: colors.bgDark,
  },
  topHeader: {
    gap: spacing.xs,
  },
  titleTabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 34,
  },
  titleTabText: {
    fontSize: font.size["2xl"],
    lineHeight: 34,
    letterSpacing: 0.5,
    color: colors.textOnDarkMuted,
    fontWeight: font.weight.semibold,
  },
  titleTabTextActive: {
    color: colors.textOnDark,
    fontWeight: font.weight.bold,
  },
  screenSubtitle: {
    fontSize: font.size.sm,
    lineHeight: 20,
    color: colors.textOnDarkSecondary,
  },
  feedViewport: {
    flex: 1,
    minHeight: 0,
    position: "relative",
  },
  activeSessionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  sentenceNavWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 4,
    paddingHorizontal: spacing.xs,
  },
  activeSessionGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SHORTS_OVERLAY_HEIGHT,
  },
  activeSessionOverlayContent: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingRight: spacing.sm,
    paddingBottom: spacing.md,
  },
  activeSessionMetaRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.lg,
  },
  activeSessionCopy: {
    flex: 1,
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  activeSessionTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 2,
  },
  activeSessionTitle: {
    flex: 1,
    fontSize: font.size.base,
    lineHeight: 24,
    color: colors.textOnDark,
    fontWeight: font.weight.bold,
  },
  activeSessionDescription: {
    fontSize: font.size.sm,
    lineHeight: 20,
    color: colors.textOnDarkSecondary,
  },
  activeSessionActions: {
    flexDirection: "column",
    alignItems: "center",
    gap: spacing.md,
  },
  actionItem: {
    alignItems: "center",
    gap: spacing.xs,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: colors.borderOnDarkStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonActive: {
    backgroundColor: colors.textOnDark,
    borderColor: colors.textOnDark,
  },
  actionLabel: {
    fontSize: font.size.xs,
    lineHeight: 16,
    color: colors.textOnDarkMuted,
    fontWeight: font.weight.medium,
  },
  actionLabelActive: {
    color: colors.textOnDark,
  },
  actionLabelDisabled: {
    color: colors.textOnDarkMuted,
  },
  feedPage: {
    width: "100%",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  stateCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderOnDark,
    backgroundColor: colors.bgDarkSubtle,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  stateTitle: {
    fontSize: font.size.base,
    lineHeight: 24,
    color: colors.textOnDark,
    fontWeight: font.weight.semibold,
  },
  stateBody: {
    fontSize: font.size.sm,
    lineHeight: 20,
    color: colors.textOnDarkSecondary,
  },
  stateText: {
    fontSize: font.size.sm,
    lineHeight: 20,
    color: colors.textOnDarkSecondary,
    textAlign: "center",
  },
  primaryCta: {
    alignSelf: "flex-start",
    borderRadius: radius.lg,
    backgroundColor: colors.textOnDark,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  primaryCtaText: {
    fontSize: font.size.sm,
    lineHeight: 18,
    color: colors.bgDark,
    fontWeight: font.weight.semibold,
  },
});
