import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { SavedSentence, Sentence } from "@inputenglish/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { SessionListItem } from "@/lib/api";
import { fetchLongformPackDetail, type LongformPackDetail } from "@/lib/api";
import LongformChapterCard from "@/components/longform/LongformChapterCard";
import LongformScriptSheet, {
  LONGFORM_SCRIPT_SHEET_COLLAPSED_HEIGHT,
} from "@/components/longform/LongformScriptSheet";
import YouTubePlayer, {
  type YouTubePlayerHandle,
} from "@/components/player/YouTubePlayer";
import { trackEvent } from "@/lib/analytics";
import { appStore } from "@/lib/stores";
import { useSubscription } from "@/hooks/useSubscription";
import { getSessionPressDestination } from "@/lib/session-access";
import { colors, font, radius, spacing } from "@/theme";

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }

  return `${Math.floor(safe / 60)}분`;
}

function resolveDescriptionPreview(text: string | null | undefined): string {
  if (!text) return "";

  const firstBlock = text
    .split(/\n{2,}|\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstBlock ?? "";
}

function resolveChapterSentences(
  transcript: Sentence[],
  chapter: SessionListItem,
): Sentence[] {
  const sentenceIds = chapter.sentence_ids ?? [];

  if (sentenceIds.length > 0) {
    const matched = sentenceIds
      .map((sentenceId) =>
        transcript.find((sentence) => sentence.id === sentenceId),
      )
      .filter((sentence): sentence is Sentence => Boolean(sentence));

    if (matched.length > 0) {
      return matched;
    }
  }

  return transcript.filter((sentence) => {
    return (
      sentence.endTime >= (chapter.start_time ?? 0) &&
      sentence.startTime <= (chapter.end_time ?? Number.POSITIVE_INFINITY)
    );
  });
}

export default function LongformScreen() {
  const { packId, entryShortId } = useLocalSearchParams<{
    packId: string;
    entryShortId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { plan } = useSubscription();

  const [detail, setDetail] = useState<LongformPackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    null,
  );
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [scriptHidden, setScriptHidden] = useState(false);
  const [loopingSentenceId, setLoopingSentenceId] = useState<string | null>(
    null,
  );

  const playerRef = useRef<YouTubePlayerHandle>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeSentenceIdRef = useRef<string | null>(null);
  const seekLockRef = useRef(false);
  const hasAppliedEntryStartRef = useRef(false);
  const selectedChapterIdRef = useRef<string | null>(null);
  const loopingSentenceIdRef = useRef<string | null>(null);

  const savedSentences = appStore((state) => state.savedSentences);
  const addSavedSentence = appStore((state) => state.addSavedSentence);
  const removeSavedSentence = appStore((state) => state.removeSavedSentence);

  useEffect(() => {
    selectedChapterIdRef.current = selectedChapterId;
  }, [selectedChapterId]);

  useEffect(() => {
    loopingSentenceIdRef.current = loopingSentenceId;
  }, [loopingSentenceId]);

  useEffect(() => {
    activeSentenceIdRef.current = activeSentenceId;
  }, [activeSentenceId]);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setDetail(null);
    setPlayerReady(false);
    setPlaying(false);
    setActiveSentenceId(null);
    setSelectedChapterId(null);
    setDescriptionExpanded(false);
    setLoopingSentenceId(null);
    hasAppliedEntryStartRef.current = false;

    fetchLongformPackDetail(packId)
      .then((nextDetail) => {
        if (cancelled) return;
        if (!nextDetail) {
          setError("롱폼 정보를 찾지 못했어요.");
          return;
        }

        setDetail(nextDetail);

        const initialChapter =
          nextDetail.shorts.find((session) => session.id === entryShortId) ??
          nextDetail.shorts[0] ??
          null;

        setSelectedChapterId(initialChapter?.id ?? null);
      })
      .catch((nextError) => {
        if (cancelled) return;
        setError(
          nextError instanceof Error
            ? nextError.message
            : "롱폼을 불러오지 못했어요.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entryShortId, packId]);

  const transcript = detail?.transcript ?? [];
  const playerHeight = width * (9 / 16);
  const maxSheetHeight = Math.max(height - (playerHeight + insets.top), 260);
  const chapterMap = useMemo(
    () =>
      new Map((detail?.shorts ?? []).map((chapter) => [chapter.id, chapter])),
    [detail?.shorts],
  );

  const savedSentenceIds = useMemo(
    () =>
      new Set(
        savedSentences
          .filter((item) => item.videoId === detail?.source_video.video_id)
          .map((item) => item.sentenceId),
      ),
    [detail?.source_video.video_id, savedSentences],
  );

  const playerBaseOffset = detail?.source_video.snippet_start_time ?? 0;
  const packStartSeconds = playerBaseOffset + (detail?.start_time ?? 0);
  const packEndSeconds = playerBaseOffset + (detail?.end_time ?? 0);
  const descriptionPreview = useMemo(
    () => resolveDescriptionPreview(detail?.description),
    [detail?.description],
  );
  const fullDescription = detail?.description?.trim() ?? "";
  const shouldShowDescriptionToggle =
    Boolean(fullDescription) &&
    (fullDescription !== descriptionPreview || fullDescription.length > 120);
  const tagline = detail?.subtitle?.trim()
    ? detail.subtitle.trim()
    : [detail?.primary_speaker_name, formatDuration(detail?.duration ?? 0)]
        .filter(Boolean)
        .join(" · ");

  const seekToSentence = useCallback(
    (sentence: Sentence, shouldPlay = true) => {
      seekLockRef.current = true;
      activeSentenceIdRef.current = sentence.id;
      setActiveSentenceId(sentence.id);
      playerRef.current?.seekTo(playerBaseOffset + sentence.startTime, true);
      setPlaying(shouldPlay);
      setTimeout(() => {
        seekLockRef.current = false;
      }, 420);
    },
    [playerBaseOffset],
  );

  const syncPlaybackState = useCallback(async () => {
    if (!detail || !playerReady || transcript.length === 0) return;

    const currentSeconds = await playerRef.current?.getCurrentTime();
    if (typeof currentSeconds !== "number" || Number.isNaN(currentSeconds))
      return;

    const relativeSeconds = Math.max(0, currentSeconds - playerBaseOffset);
    const loopingSentence = loopingSentenceIdRef.current
      ? transcript.find(
          (sentence) => sentence.id === loopingSentenceIdRef.current,
        )
      : null;

    if (loopingSentence && relativeSeconds >= loopingSentence.endTime - 0.08) {
      seekLockRef.current = true;
      playerRef.current?.seekTo(
        playerBaseOffset + loopingSentence.startTime,
        true,
      );
      setTimeout(() => {
        seekLockRef.current = false;
      }, 280);
      return;
    }

    if (packEndSeconds > 0 && currentSeconds >= packEndSeconds - 0.08) {
      setPlaying(false);
      playerRef.current?.seekTo(packStartSeconds, true);
      return;
    }

    const nextActiveSentence =
      transcript.find((sentence) => {
        return (
          relativeSeconds >= sentence.startTime &&
          relativeSeconds < sentence.endTime
        );
      }) ??
      (transcript.length > 0 &&
      relativeSeconds >= transcript[transcript.length - 1].startTime
        ? transcript[transcript.length - 1]
        : null);

    if (
      nextActiveSentence &&
      nextActiveSentence.id !== activeSentenceIdRef.current
    ) {
      activeSentenceIdRef.current = nextActiveSentence.id;
      setActiveSentenceId(nextActiveSentence.id);
    }

    const nextChapter = detail.shorts.find((chapter) => {
      return (
        relativeSeconds >= (chapter.start_time ?? 0) &&
        relativeSeconds < (chapter.end_time ?? Number.POSITIVE_INFINITY)
      );
    });

    if (nextChapter && nextChapter.id !== selectedChapterIdRef.current) {
      setSelectedChapterId(nextChapter.id);
    }
  }, [
    detail,
    packEndSeconds,
    packStartSeconds,
    playerBaseOffset,
    playerReady,
    transcript,
  ]);

  useEffect(() => {
    if (!playing) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(() => {
      if (seekLockRef.current) return;
      void syncPlaybackState();
    }, 160);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [playing, syncPlaybackState]);

  const handleTranscriptPress = useCallback(
    (sentence: Sentence) => {
      setLoopingSentenceId(null);
      seekToSentence(sentence, true);
    },
    [seekToSentence],
  );

  const handleSentenceLoopToggle = useCallback(
    (sentence: Sentence) => {
      setLoopingSentenceId((current) => {
        const next = current === sentence.id ? null : sentence.id;
        if (next) {
          seekToSentence(sentence, true);
        }
        return next;
      });
    },
    [seekToSentence],
  );

  const handleSentenceSaveToggle = useCallback(
    (sentence: Sentence) => {
      if (!detail) return;

      const existing = savedSentences.find(
        (item) =>
          item.sentenceId === sentence.id &&
          item.videoId === detail.source_video.video_id,
      );

      if (existing) {
        void removeSavedSentence(existing.id);
        return;
      }

      void addSavedSentence({
        id: crypto.randomUUID(),
        videoId: detail.source_video.video_id,
        sentenceId: sentence.id,
        sentenceText: sentence.text,
        startTime: sentence.startTime,
        endTime: sentence.endTime,
        createdAt: Date.now(),
      } as SavedSentence);
    },
    [addSavedSentence, detail, removeSavedSentence, savedSentences],
  );

  const handleChapterPress = useCallback(
    (chapter: SessionListItem) => {
      trackEvent("longform_chapter_practice_opened", {
        packId,
        chapterId: chapter.id,
        sourceVideoId: chapter.source_video_id,
      });
      router.push(getSessionPressDestination(chapter, plan));
    },
    [packId, plan, router],
  );

  const handlePlayerReady = useCallback(() => {
    setPlayerReady(true);

    if (!detail || hasAppliedEntryStartRef.current) return;

    const anchorChapter =
      detail.shorts.find((chapter) => chapter.id === entryShortId) ??
      detail.shorts[0] ??
      null;
    const anchorSentence = anchorChapter
      ? resolveChapterSentences(transcript, anchorChapter)[0]
      : transcript[0];

    hasAppliedEntryStartRef.current = true;

    if (anchorChapter) {
      setSelectedChapterId(anchorChapter.id);
    }

    if (anchorSentence) {
      seekToSentence(anchorSentence, true);
      return;
    }

    playerRef.current?.seekTo(packStartSeconds, true);
    setPlaying(true);
  }, [detail, entryShortId, packStartSeconds, seekToSentence, transcript]);

  const handleRetry = useCallback(() => {
    router.replace(
      `/longform/${packId}${entryShortId ? `?entryShortId=${entryShortId}` : ""}` as never,
    );
  }, [entryShortId, packId, router]);

  const toggleDescriptionExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDescriptionExpanded((current) => !current);
  }, []);

  if (loading) {
    return (
      <View style={styles.stateScreen}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.textOnDark} />
        <Text style={styles.stateText}>롱폼을 준비하고 있어요…</Text>
      </View>
    );
  }

  if (!detail || error) {
    return (
      <View style={styles.stateScreen}>
        <StatusBar style="light" />
        <Text style={styles.stateTitle}>
          {error ?? "롱폼을 찾지 못했어요."}
        </Text>
        <Pressable style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <View
        style={[
          styles.playerFrame,
          {
            height: playerHeight,
            marginTop: insets.top,
          },
        ]}
      >
        <YouTubePlayer
          ref={playerRef}
          videoId={detail.source_video.video_id}
          playing={playing}
          startSeconds={packStartSeconds}
          onReady={handlePlayerReady}
          onChangeState={(state) => {
            if (state === "playing") {
              setPlaying(true);
              return;
            }

            if (state === "paused" || state === "ended") {
              setPlaying(false);
            }
          }}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="뒤로 가기"
        style={[styles.backButton, { top: insets.top + 10 }]}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={20} color={colors.textOnDark} />
      </Pressable>

      <FlatList
        data={detail.shorts}
        keyExtractor={(item) => item.id}
        style={styles.contentList}
        contentContainerStyle={{
          paddingBottom:
            LONGFORM_SCRIPT_SHEET_COLLAPSED_HEIGHT + insets.bottom + spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <LongformChapterCard
            session={item}
            isActive={selectedChapterId === item.id}
            onPress={handleChapterPress}
            isLast={detail.shorts[detail.shorts.length - 1]?.id === item.id}
          />
        )}
        ListHeaderComponent={
          <View style={styles.metaSection}>
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Text style={styles.title}>{detail.title}</Text>
                {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
              </View>
            </View>

            {fullDescription || tagline || detail.channel_name ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  descriptionExpanded ? "영상 정보 접기" : "영상 정보 펼치기"
                }
                onPress={toggleDescriptionExpanded}
                style={styles.descriptionCard}
              >
                {descriptionExpanded && detail.channel_name ? (
                  <Text style={styles.metaInfoLabel}>
                    {detail.channel_name}
                  </Text>
                ) : null}
                <Text
                  style={styles.description}
                  numberOfLines={descriptionExpanded ? undefined : 3}
                >
                  {descriptionExpanded ? fullDescription : descriptionPreview}
                </Text>
                {descriptionExpanded ? (
                  <View style={styles.metaInfoStack}>
                    {tagline ? (
                      <Text style={styles.metaInfoText}>{tagline}</Text>
                    ) : null}
                    {detail.primary_speaker_name ? (
                      <Text style={styles.metaInfoText}>
                        출연자 · {detail.primary_speaker_name}
                      </Text>
                    ) : null}
                    <Text style={styles.metaInfoText}>
                      길이 · {formatDuration(detail.duration)}
                    </Text>
                  </View>
                ) : null}
                {shouldShowDescriptionToggle ? (
                  <View style={styles.descriptionToggle}>
                    <Ionicons
                      name={descriptionExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={colors.textOnDarkSecondary}
                    />
                  </View>
                ) : null}
              </Pressable>
            ) : null}

            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>배워볼 표현</Text>
              <Text style={styles.listCaption}>
                마음에 드는 구간을 누르면 바로 학습 화면으로 이어져요.
              </Text>
            </View>
          </View>
        }
      />

      <LongformScriptSheet
        sentences={transcript}
        activeSentenceId={activeSentenceId}
        maxHeight={maxSheetHeight}
        bottomInset={insets.bottom}
        initialExpanded={Boolean(entryShortId)}
        loopingSentenceId={loopingSentenceId}
        savedSentenceIds={savedSentenceIds}
        showTranslation={showTranslation}
        scriptHidden={scriptHidden}
        onSentencePress={handleTranscriptPress}
        onLoopToggle={handleSentenceLoopToggle}
        onSaveToggle={handleSentenceSaveToggle}
        onToggleTranslation={() => setShowTranslation((current) => !current)}
        onToggleScriptHidden={() => setScriptHidden((current) => !current)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  stateScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    backgroundColor: colors.bgDark,
    paddingHorizontal: spacing.xl,
  },
  stateTitle: {
    fontSize: font.size.lg,
    lineHeight: 28,
    color: colors.textOnDark,
    fontWeight: font.weight.semibold,
    textAlign: "center",
  },
  stateText: {
    fontSize: font.size.md,
    lineHeight: 24,
    color: colors.textOnDarkSecondary,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.textOnDark,
  },
  retryButtonText: {
    fontSize: font.size.sm,
    lineHeight: 18,
    color: colors.bgDark,
    fontWeight: font.weight.semibold,
  },
  playerFrame: {
    width: "100%",
    backgroundColor: colors.bgDark,
  },
  backButton: {
    position: "absolute",
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.78)",
    zIndex: 20,
  },
  contentList: {
    flex: 1,
  },
  metaSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  titleCopy: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: font.size.xl,
    lineHeight: 30,
    color: colors.textOnDark,
    fontWeight: font.weight.semibold,
  },
  tagline: {
    fontSize: font.size.sm,
    lineHeight: 20,
    color: colors.textOnDarkMuted,
  },
  descriptionCard: {
    gap: 6,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bgDarkMuted,
  },
  description: {
    fontSize: font.size.md,
    lineHeight: 24,
    color: colors.textOnDarkSecondary,
  },
  metaInfoLabel: {
    fontSize: font.size.xs,
    lineHeight: 16,
    color: colors.textOnDarkMuted,
    fontWeight: font.weight.semibold,
    letterSpacing: 0.5,
  },
  metaInfoStack: {
    gap: 4,
    paddingTop: 2,
  },
  metaInfoText: {
    fontSize: font.size.sm,
    lineHeight: 20,
    color: colors.textOnDarkMuted,
  },
  descriptionToggle: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  listHeader: {
    paddingTop: spacing.xl,
    gap: 4,
  },
  listTitle: {
    fontSize: font.size.lg,
    lineHeight: 28,
    color: colors.textOnDark,
    fontWeight: font.weight.semibold,
  },
  listCaption: {
    fontSize: font.size.sm,
    lineHeight: 20,
    color: colors.textOnDarkSecondary,
  },
});
