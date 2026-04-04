import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSessionSheet } from "@/contexts/SessionSheetContext";
import { fetchCuratedVideo } from "@/lib/api";
import type { CuratedVideo, Sentence } from "@inputenglish/shared";
import YouTubePlayer, { YouTubePlayerHandle } from "./YouTubePlayer";
import { colors, font, radius, spacing } from "@/theme";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SCREEN_WIDTH = Dimensions.get("window").width;
const DISMISS_THRESHOLD = 120;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SessionSheet() {
  const {
    session,
    isPlaying,
    isExpanded,
    togglePlay,
    closeSession,
    collapseSheet,
  } = useSessionSheet();
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const insets = useSafeAreaInsets();

  const [video, setVideo] = useState<CuratedVideo | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const activeSentenceIdRef = useRef<string | null>(null);
  const seekLockRef = useRef(false);
  const isPollingRef = useRef(false);
  const seekDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const sentences = video?.transcript ?? [];
  const playerBaseOffset = video?.snippet_start_time ?? 0;

  // Animate sheet in/out
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isExpanded ? 0 : SCREEN_HEIGHT,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [isExpanded, translateY]);

  // Load video data
  useEffect(() => {
    if (!session) {
      setVideo(null);
      return;
    }
    setLoading(true);
    fetchCuratedVideo(session.source_video_id)
      .then(setVideo)
      .catch(() => setVideo(null))
      .finally(() => setLoading(false));
  }, [session?.source_video_id]);

  // Time polling for active sentence
  useEffect(() => {
    if (!isPlaying || !isExpanded || sentences.length === 0) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const offset = playerBaseOffset;

    pollRef.current = setInterval(async () => {
      if (seekLockRef.current || isPollingRef.current) return;
      isPollingRef.current = true;
      try {
        const t = await playerRef.current?.getCurrentTime();
        if (t === undefined) return;
        const rel = Math.max(0, t - offset);
        const active = sentences.find(
          (s) => rel >= s.startTime && rel < s.endTime,
        );
        if (active && active.id !== activeSentenceIdRef.current) {
          activeSentenceIdRef.current = active.id;
          setActiveSentenceId(active.id);
        }
      } finally {
        isPollingRef.current = false;
      }
    }, 100);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isPlaying, isExpanded, sentences, playerBaseOffset]);

  // Pan responder for drag-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 10 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > DISMISS_THRESHOLD) {
          collapseSheet();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    }),
  ).current;

  const handleSentencePress = useCallback(
    (sentence: Sentence) => {
      // Debounce the seek so rapid taps don't race with the polling loop.
      // Pattern mirrors StudyScreen.handleSentenceTap: set state immediately
      // for instant visual feedback, then issue seekTo inside the debounce.
      // seekLock prevents the polling loop from overwriting activeSentenceId
      // during the WebView bridge round-trip for getCurrentTime().
      if (seekDebounce.current) clearTimeout(seekDebounce.current);
      seekLockRef.current = true;
      activeSentenceIdRef.current = sentence.id;
      setActiveSentenceId(sentence.id);

      seekDebounce.current = setTimeout(() => {
        playerRef.current?.seekTo(playerBaseOffset + sentence.startTime);
        // Hold the lock for an additional 500 ms after seek so the bridge
        // has time to settle before polling reads getCurrentTime() again.
        setTimeout(() => {
          seekLockRef.current = false;
        }, 500);
      }, 300);
    },
    [playerBaseOffset],
  );

  const renderSentence = useCallback(
    ({ item }: { item: Sentence }) => {
      const isActive = item.id === activeSentenceId;
      return (
        <TouchableOpacity
          style={[styles.sentenceRow, isActive && styles.sentenceRowActive]}
          onPress={() => handleSentencePress(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.sentenceTime}>{formatTime(item.startTime)}</Text>
          <View style={styles.sentenceTextWrap}>
            <Text
              style={[
                styles.sentenceText,
                isActive && styles.sentenceTextActive,
              ]}
            >
              {item.text}
            </Text>
            {item.translation && (
              <Text style={styles.sentenceTranslation}>{item.translation}</Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [activeSentenceId, handleSentencePress],
  );

  if (!session) return null;

  return (
    <Animated.View
      style={[
        styles.overlay,
        { transform: [{ translateY }], paddingTop: insets.top },
      ]}
    >
      {/* Drag Handle */}
      <View {...panResponder.panHandlers} style={styles.dragArea}>
        <View style={styles.dragHandle} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={collapseSheet} style={styles.headerButton}>
            <Ionicons name="chevron-down" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {session.title}
            </Text>
            {session.channel_name && (
              <Text style={styles.headerChannel} numberOfLines={1}>
                {session.channel_name}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={closeSession} style={styles.headerButton}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* YouTube Player */}
      <View style={styles.playerContainer}>
        {video?.video_id ? (
          <YouTubePlayer
            ref={playerRef}
            videoId={video.video_id}
            playing={isPlaying}
            startSeconds={playerBaseOffset}
            onReady={() => {
              if (!isPlayingRef.current) togglePlay();
            }}
            onChangeState={(state: string) => {
              if (state === "playing" && !isPlayingRef.current) togglePlay();
              if (state === "paused" && isPlayingRef.current) togglePlay();
            }}
          />
        ) : (
          <View style={styles.playerLoading}>
            <Text style={styles.loadingText}>
              {loading ? "로딩 중..." : "영상을 불러올 수 없습니다"}
            </Text>
          </View>
        )}
      </View>

      {/* Play Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.playButton} onPress={togglePlay}>
          <Ionicons
            name={isPlaying ? "pause-circle" : "play-circle"}
            size={52}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Script */}
      <View style={styles.scriptHeader}>
        <Text style={styles.scriptLabel}>스크립트</Text>
      </View>

      <FlatList
        data={sentences}
        keyExtractor={(item) => item.id}
        renderItem={renderSentence}
        contentContainerStyle={[
          styles.scriptList,
          { paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    zIndex: 100,
  },

  // Drag
  dragArea: {
    paddingTop: 8,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: 8,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    gap: 12,
  },
  headerButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: font.weight.semibold,
    color: colors.text,
  },
  headerChannel: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Player
  playerContainer: {
    width: "100%",
    backgroundColor: colors.bgInverse,
  },
  playerLoading: {
    height: SCREEN_WIDTH * (9 / 16),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgInverse,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Controls
  controls: {
    alignItems: "center",
    paddingVertical: 16,
  },
  playButton: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },

  // Script
  scriptHeader: {
    paddingHorizontal: spacing.md,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scriptLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  scriptList: {},
  sentenceRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 12,
  },
  sentenceRowActive: {
    backgroundColor: colors.bgSubtle,
  },
  sentenceTime: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500",
    width: 36,
    paddingTop: 2,
    fontVariant: ["tabular-nums"],
  },
  sentenceTextWrap: {
    flex: 1,
    gap: 4,
  },
  sentenceText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  sentenceTextActive: {
    fontWeight: font.weight.semibold,
  },
  sentenceTranslation: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
