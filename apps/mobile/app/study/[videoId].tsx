// @MX:ANCHOR: StudyScreen - blind/script toggle + shadowing navigation hub
// @MX:REASON: [AUTO] fan_in >= 3: navigated from HomeScreen, deeplinks, and study session flow
// @MX:SPEC: SPEC-MOBILE-005 - REQ-U-001 through REQ-C-001
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import type { Sentence, CuratedVideo, AppHighlight } from "@shadowoo/shared";
import { fetchCuratedVideo } from "../../src/lib/api";
import { appStore, studyStore } from "../../src/lib/stores";
import YouTubePlayer, {
  YouTubePlayerHandle,
} from "../../src/components/player/YouTubePlayer";
import HighlightBottomSheet from "../../src/components/study/HighlightBottomSheet";
import ErrorToast from "../../src/components/common/ErrorToast";

export default function StudyScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();

  const [video, setVideo] = useState<CuratedVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // blind = no script shown, script = script visible
  const [scriptMode, setScriptMode] = useState(false);
  const [playing, setPlaying] = useState(false);

  const [focusedSentence, setFocusedSentence] = useState<Sentence | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [savingHighlight, setSavingHighlight] = useState(false);

  const [errorToast, setErrorToast] = useState<{
    message: string;
    retry?: () => void;
  } | null>(null);

  const playerRef = useRef<YouTubePlayerHandle>(null);
  const listRef = useRef<FlatList<Sentence>>(null);

  const addHighlight = appStore((s) => s.addHighlight);

  // Load video and create/resume study session (one-shot on mount) - REQ-E-001
  // studyStore.getState() is intentional: session init is a one-time side effect,
  // not a reactive subscription. Subscribing to sessions would re-fire this effect
  // whenever ANY session changes (e.g. ShadowingScreen completing a session),
  // causing createSession → sessions change → effect re-fire → infinite loop.
  useEffect(() => {
    if (!videoId) return;
    fetchCuratedVideo(videoId)
      .then((v) => {
        setVideo(v);
        const { sessions, createSession } = studyStore.getState();
        const existing = sessions.find(
          (s) => s.videoId === videoId && !s.isCompleted,
        );
        if (!existing) {
          createSession(videoId, v.title, v.transcript ?? []);
        }
      })
      .catch((e: Error) => setError(e.message ?? "Failed to load video"))
      .finally(() => setLoading(false));
  }, [videoId]);

  const handlePlayerStateChange = useCallback((state: string) => {
    if (state === "playing") setPlaying(true);
    else if (state === "paused" || state === "ended") setPlaying(false);
  }, []);

  // REQ-E-007: long-press opens highlight sheet
  const handleLongPress = useCallback((sentence: Sentence) => {
    setFocusedSentence(sentence);
    setSheetVisible(true);
  }, []);

  const handleSentenceTap = useCallback(
    (sentence: Sentence) => {
      const offset = video?.snippet_start_time ?? 0;
      playerRef.current?.seekTo(sentence.startTime + offset);
    },
    [video],
  );

  // REQ-E-008, REQ-C-001: save highlight with optimistic update + rollback
  const handleSaveHighlight = useCallback(
    async (userNote: string) => {
      if (!videoId || !focusedSentence) return;
      setSavingHighlight(true);
      const highlight: AppHighlight = {
        id: Crypto.randomUUID(),
        videoId,
        sentenceId: focusedSentence.id,
        originalText: focusedSentence.text,
        userNote,
        createdAt: Date.now(),
      };
      setSheetVisible(false);
      setFocusedSentence(null);
      try {
        await addHighlight(highlight);
      } catch {
        setErrorToast({
          message: "저장에 실패했습니다.",
          retry: () => handleSaveHighlight(userNote),
        });
      } finally {
        setSavingHighlight(false);
      }
    },
    [videoId, focusedSentence, addHighlight],
  );

  const handleSheetClose = useCallback(() => {
    setSheetVisible(false);
    setFocusedSentence(null);
  }, []);

  const handleShadowing = useCallback(() => {
    router.push(`/shadowing/${videoId}`);
  }, [videoId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  if (error || !video) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>
          {error ?? "영상을 불러올 수 없습니다."}
        </Text>
      </SafeAreaView>
    );
  }

  const sentences = video.transcript ?? [];

  return (
    <SafeAreaView style={styles.container}>
      {/* YouTube Player */}
      <YouTubePlayer
        ref={playerRef}
        videoId={video.video_id}
        playing={playing}
        playbackRate={1}
        onChangeState={handlePlayerStateChange}
        startSeconds={video.snippet_start_time}
      />

      {/* Blind / Script Toggle - REQ-E-002 */}
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setScriptMode((m) => !m)}
        activeOpacity={0.8}
      >
        <Text style={styles.toggleButtonText}>
          {scriptMode ? "📖 스크립트 숨기기" : "📝 스크립트 보기"}
        </Text>
      </TouchableOpacity>

      {/* Script content area - REQ-S-001, REQ-S-002 */}
      {!scriptMode ? (
        <View style={styles.blindMessage}>
          <Text style={styles.blindMessageText}>
            스크립트 없이 들어보세요 👂
          </Text>
        </View>
      ) : sentences.length === 0 ? (
        <View style={styles.blindMessage}>
          <Text style={styles.blindMessageText}>자막이 없습니다.</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={sentences}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.scriptLine,
                focusedSentence?.id === item.id && styles.scriptLineHighlighted,
              ]}
              onPress={() => handleSentenceTap(item)}
              onLongPress={() => handleLongPress(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.scriptLineText}>{item.text}</Text>
              {item.translation ? (
                <Text style={styles.scriptLineTranslation}>
                  {item.translation}
                </Text>
              ) : null}
            </TouchableOpacity>
          )}
          style={styles.list}
        />
      )}

      {/* Shadowing navigation button - REQ-E-010 */}
      <TouchableOpacity
        style={styles.shadowingButton}
        onPress={handleShadowing}
        activeOpacity={0.85}
      >
        <Text style={styles.shadowingButtonText}>쉐도잉 시작 →</Text>
      </TouchableOpacity>

      {/* Highlight Bottom Sheet - REQ-E-007, REQ-E-008 */}
      <HighlightBottomSheet
        visible={sheetVisible}
        sentence={focusedSentence}
        saving={savingHighlight}
        onSave={handleSaveHighlight}
        onClose={handleSheetClose}
      />

      {/* Error Toast - REQ-E-009 */}
      <ErrorToast
        visible={errorToast !== null}
        message={errorToast?.message ?? ""}
        onRetry={errorToast?.retry}
        onDismiss={() => setErrorToast(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#e00",
  },
  toggleButton: {
    marginHorizontal: 16,
    marginVertical: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#F0F0F0",
    borderRadius: 10,
    alignItems: "center",
  },
  toggleButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  blindMessage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  blindMessageText: {
    fontSize: 17,
    color: "#777",
    textAlign: "center",
  },
  list: {
    flex: 1,
  },
  scriptLine: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  scriptLineHighlighted: {
    backgroundColor: "#FFF9C4",
  },
  scriptLineText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#222",
  },
  scriptLineTranslation: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
    lineHeight: 19,
  },
  shadowingButton: {
    margin: 16,
    paddingVertical: 14,
    backgroundColor: "#007AFF",
    borderRadius: 12,
    alignItems: "center",
  },
  shadowingButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
