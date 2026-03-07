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
import * as Crypto from "expo-crypto";
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
  // Refs mirror state so the poll callback always reads fresh values without recreating the interval
  const activeSentenceIdRef = useRef<string | null>(null);
  const loopingSentenceIdRef = useRef<string | null>(null);
  const seekDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  // Deps: only playing/video — loop/active state read via refs to avoid interval recreation on every sentence change
  useEffect(() => {
    if (!playing || !video?.transcript?.length) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const sentences = video.transcript;
    const offset = video.snippet_start_time ?? 0;
    // Seek 80ms before endTime to compensate for poll interval + WebView bridge latency
    const LOOP_SEEK_LEAD_MS = 0.08;

    pollIntervalRef.current = setInterval(async () => {
      const currentTime = await playerRef.current?.getCurrentTime();
      if (currentTime === undefined) return;

      const relativeTime = currentTime - offset;

      // Loop handling - REQ-S-002, REQ-C-002
      const loopId = loopingSentenceIdRef.current;
      if (loopId) {
        const loopSentence = sentences.find((s) => s.id === loopId);
        if (
          loopSentence &&
          relativeTime >= loopSentence.endTime - LOOP_SEEK_LEAD_MS
        ) {
          playerRef.current?.seekTo(loopSentence.startTime + offset);
          return;
        }
      }

      // Active sentence detection: find the LAST sentence whose startTime has passed.
      // Reverse traversal avoids returning an earlier sentence when endTimes overlap.
      let active: (typeof sentences)[0] | undefined;
      for (let i = sentences.length - 1; i >= 0; i--) {
        if (sentences[i].startTime <= relativeTime) {
          active = sentences[i];
          break;
        }
      }

      if (active && active.id !== activeSentenceIdRef.current) {
        activeSentenceIdRef.current = active.id;
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
  }, [playing, video]);

  const handleSentenceTap = useCallback(
    (sentence: Sentence) => {
      // Debounce rapid taps (300ms) to prevent seek spam over WebView bridge
      if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
      seekDebounceRef.current = setTimeout(() => {
        const offset = video?.snippet_start_time ?? 0;
        playerRef.current?.seekTo(sentence.startTime + offset);
        activeSentenceIdRef.current = sentence.id;
        setActiveSentenceId(sentence.id);
      }, 300);
    },
    [video],
  );

  const handleLoopToggle = useCallback((sentence: Sentence) => {
    // Enforce minimum 0.5s loop duration to prevent rapid infinite seeks
    const duration = sentence.endTime - sentence.startTime;
    if (duration < 0.5) return;
    setLoopingSentenceId((prev) => {
      const next = prev === sentence.id ? null : sentence.id;
      loopingSentenceIdRef.current = next;
      return next;
    });
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
          id: Crypto.randomUUID(),
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
        videoId={videoId}
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
      {sentences.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>자막이 없습니다.</Text>
        </View>
      ) : (
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
      )}
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
  emptyText: {
    fontSize: 15,
    color: "#888",
  },
  list: {
    flex: 1,
  },
});
