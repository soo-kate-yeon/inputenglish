// @MX:ANCHOR: ListeningScreen - core YouTube + script sync screen
// @MX:REASON: [AUTO] fan_in >= 3: navigated from HomeScreen, deeplinks, and study flow
// @MX:SPEC: SPEC-MOBILE-003 - REQ-E-001 through REQ-C-002
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { Sentence, SavedSentence, CuratedVideo } from "@shadowoo/shared";
import { fetchCuratedVideo } from "../../src/lib/api";
import { appStore } from "../../src/lib/stores";
import YouTubePlayer, {
  YouTubePlayerHandle,
} from "../../src/components/player/YouTubePlayer";
import ListeningHeader from "../../src/components/listening/ListeningHeader";
import ScriptLine, {
  SCRIPT_LINE_HEIGHT,
} from "../../src/components/listening/ScriptLine";
import ScriptToggle from "../../src/components/listening/ScriptToggle";

export default function ListeningScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();

  const [video, setVideo] = useState<CuratedVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [scriptHidden, setScriptHidden] = useState(false);
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const [loopingSentenceId, setLoopingSentenceId] = useState<string | null>(
    null,
  );

  const playerRef = useRef<YouTubePlayerHandle>(null);
  const listRef = useRef<FlatList<Sentence>>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const savedSentences = appStore((s) => s.savedSentences);
  const addSavedSentence = appStore((s) => s.addSavedSentence);
  const removeSavedSentence = appStore((s) => s.removeSavedSentence);

  // Load video data from Supabase
  useEffect(() => {
    if (!videoId) return;
    fetchCuratedVideo(videoId)
      .then(setVideo)
      .catch((e) => setError(e.message ?? "Failed to load video"))
      .finally(() => setLoading(false));
  }, [videoId]);

  // Background pause - REQ-E-006, REQ-N-002
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        setPlaying(false);
      }
    });
    return () => sub.remove();
  }, []);

  // 100ms polling for active sentence sync - REQ-E-002, REQ-S-001
  useEffect(() => {
    if (!playing || !video?.transcript?.length) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    pollIntervalRef.current = setInterval(async () => {
      const currentTime = await playerRef.current?.getCurrentTime();
      if (currentTime === undefined) return;

      const sentences = video.transcript;

      // Loop handling - REQ-S-002, REQ-C-002
      if (loopingSentenceId) {
        const loopSentence = sentences.find((s) => s.id === loopingSentenceId);
        if (loopSentence && currentTime >= loopSentence.endTime) {
          playerRef.current?.seekTo(loopSentence.startTime);
          return;
        }
      }

      // Active sentence detection
      const active = sentences.find(
        (s) => currentTime >= s.startTime && currentTime < s.endTime,
      );

      if (active && active.id !== activeSentenceId) {
        setActiveSentenceId(active.id);
        const index = sentences.indexOf(active);
        if (index >= 0) {
          listRef.current?.scrollToIndex({
            index,
            animated: true,
            viewOffset: 0,
          });
        }
      }
    }, 100);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [playing, video, activeSentenceId, loopingSentenceId]);

  const handleSentenceTap = useCallback((sentence: Sentence) => {
    playerRef.current?.seekTo(sentence.startTime);
    setActiveSentenceId(sentence.id);
  }, []);

  const handleLoopToggle = useCallback((sentence: Sentence) => {
    setLoopingSentenceId((prev) => (prev === sentence.id ? null : sentence.id));
  }, []);

  const handleSaveToggle = useCallback(
    (sentence: Sentence) => {
      if (!videoId) return;
      const existing = savedSentences.find(
        (s) => s.sentenceId === sentence.id && s.videoId === videoId,
      );
      if (existing) {
        removeSavedSentence(existing.id);
      } else {
        const saved: SavedSentence = {
          id: `${videoId}_${sentence.id}`,
          videoId,
          sentenceId: sentence.id,
          sentenceText: sentence.text,
          startTime: sentence.startTime,
          endTime: sentence.endTime,
          createdAt: Date.now(),
        };
        addSavedSentence(saved);
      }
    },
    [videoId, savedSentences, addSavedSentence, removeSavedSentence],
  );

  const handlePlayerStateChange = useCallback((state: string) => {
    if (state === "playing") setPlaying(true);
    else if (state === "paused" || state === "ended") setPlaying(false);
  }, []);

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
      <ListeningHeader
        title={video.title}
        playbackRate={playbackRate}
        onRateChange={setPlaybackRate}
      />
      <YouTubePlayer
        ref={playerRef}
        videoId={video.video_id}
        playing={playing}
        playbackRate={playbackRate}
        onChangeState={handlePlayerStateChange}
        startSeconds={video.snippet_start_time}
      />
      <ScriptToggle
        hidden={scriptHidden}
        onPress={() => setScriptHidden((h) => !h)}
      />
      <FlatList
        ref={listRef}
        data={sentences}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ScriptLine
            sentence={item}
            isActive={item.id === activeSentenceId}
            isLooping={item.id === loopingSentenceId}
            isSaved={savedSentences.some(
              (s) => s.sentenceId === item.id && s.videoId === videoId,
            )}
            scriptHidden={scriptHidden}
            onTap={handleSentenceTap}
            onLoopToggle={handleLoopToggle}
            onSaveToggle={handleSaveToggle}
          />
        )}
        getItemLayout={(_data, index) => ({
          length: SCRIPT_LINE_HEIGHT,
          offset: SCRIPT_LINE_HEIGHT * index,
          index,
        })}
        onScrollToIndexFailed={() => {
          /* ignore scroll failures for short lists */
        }}
        style={styles.list}
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
  list: {
    flex: 1,
  },
});
