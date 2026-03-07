// @MX:ANCHOR: ShadowingScreen - core YouTube + script + recording screen
// @MX:REASON: [AUTO] fan_in >= 3: navigated from HomeScreen, deeplinks, and study flow
// @MX:SPEC: SPEC-MOBILE-004 - REQ-U-001 through REQ-C-002
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { Sentence, CuratedVideo } from "@shadowoo/shared";
import { groupSentencesByMode } from "@shadowoo/shared";
import { fetchCuratedVideo } from "../../src/lib/api";
import { studyStore } from "../../src/lib/stores";
import YouTubePlayer, {
  YouTubePlayerHandle,
} from "../../src/components/player/YouTubePlayer";
import ShadowingHeader, {
  ShadowingMode,
} from "../../src/components/shadowing/ShadowingHeader";
import ShadowingScriptLine, {
  SHADOWING_SCRIPT_LINE_HEIGHT,
} from "../../src/components/shadowing/ShadowingScriptLine";
import RecordingBar from "../../src/components/shadowing/RecordingBar";
import useAudioRecorder from "../../src/hooks/useAudioRecorder";

export default function ShadowingScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();

  const [video, setVideo] = useState<CuratedVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const [currentRecordingSentenceId, setCurrentRecordingSentenceId] = useState<
    string | null
  >(null);
  const [recordedSentences, setRecordedSentences] = useState<
    Record<string, string>
  >({}); // sentenceId -> fileUri
  const [mode, setMode] = useState<ShadowingMode>("sentence");
  const [sentences, setSentences] = useState<Sentence[]>([]);

  const playerRef = useRef<YouTubePlayerHandle>(null);
  const flatListRef = useRef<FlatList<Sentence>>(null);
  const activeSentenceIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    recordingState,
    audioUri,
    duration,
    isPlaying: isPlayingRecording,
    playbackProgress,
    startRecording,
    stopRecording,
    playRecording,
    pauseRecording,
    resetRecording,
  } = useAudioRecorder();

  const currentSession = studyStore((s) => s.currentSession);

  // Load video and update session phase on mount - REQ-C-001
  useEffect(() => {
    if (!videoId) return;
    fetchCuratedVideo(videoId)
      .then((v) => {
        setVideo(v);
        // Parse transcript and apply grouping
        const allSentences = v.transcript ?? [];
        setSentences(groupSentencesByMode(allSentences, "sentence"));
      })
      .catch((e: Error) => setError(e.message ?? "Failed to load video"))
      .finally(() => setLoading(false));

    // Update study session phase
    if (currentSession) {
      studyStore.getState().updateSessionPhase(currentSession.id, "shadowing");
    }
  }, [videoId, currentSession]);

  // Background pause + recording stop - REQ-E-006
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        setPlaying(false);
        if (recordingState === "recording") {
          void stopRecording();
        }
      }
    });
    return () => sub.remove();
  }, [recordingState, stopRecording]);

  // 100ms polling for active sentence sync - same pattern as listening
  useEffect(() => {
    if (!playing || !video?.transcript?.length) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const allSentences = video.transcript;
    const offset = video.snippet_start_time ?? 0;

    pollIntervalRef.current = setInterval(async () => {
      const currentTime = await playerRef.current?.getCurrentTime();
      if (currentTime === undefined) return;

      const relativeTime = currentTime - offset;

      // Active sentence detection (reverse traversal)
      let active: (typeof allSentences)[0] | undefined;
      for (let i = allSentences.length - 1; i >= 0; i--) {
        if (allSentences[i].startTime <= relativeTime) {
          active = allSentences[i];
          break;
        }
      }

      if (active && active.id !== activeSentenceIdRef.current) {
        activeSentenceIdRef.current = active.id;
        setActiveSentenceId(active.id);
        const index = sentences.indexOf(active);
        if (index >= 0) {
          flatListRef.current?.scrollToIndex({
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
  }, [playing, video, sentences]);

  // Re-apply grouping when mode changes - REQ-E-005
  const handleModeChange = useCallback(
    (newMode: ShadowingMode) => {
      setMode(newMode);
      if (video?.transcript) {
        const grouped = groupSentencesByMode(video.transcript, newMode);
        setSentences(grouped);
        setActiveSentenceId(null);
        activeSentenceIdRef.current = null;
      }
    },
    [video],
  );

  // Record button tap: pause YouTube, start recording - REQ-E-001, REQ-C-001
  const handleRecord = useCallback(
    async (sentenceId: string) => {
      setPlaying(false);
      setCurrentRecordingSentenceId(sentenceId);
      await startRecording();
    },
    [startRecording],
  );

  // Stop recording - REQ-E-002
  const handleStop = useCallback(async () => {
    await stopRecording();
  }, [stopRecording]);

  // Confirm recording: save to state - REQ-C-002
  const handleConfirm = useCallback(async () => {
    if (!currentRecordingSentenceId || !audioUri) {
      Alert.alert("오류", "녹음 파일이 없습니다.");
      return;
    }
    setRecordedSentences((prev) => ({
      ...prev,
      [currentRecordingSentenceId]: audioUri,
    }));
    setCurrentRecordingSentenceId(null);
    await resetRecording();
  }, [currentRecordingSentenceId, audioUri, resetRecording]);

  // Re-record: reset to idle - REQ-E-004
  const handleReRecord = useCallback(async () => {
    await resetRecording();
    setCurrentRecordingSentenceId(null);
  }, [resetRecording]);

  // Seek when sentence is tapped
  const handleSeek = useCallback(
    (sentenceId: string) => {
      if (!video) return;
      const sentence = video.transcript?.find((s) => s.id === sentenceId);
      if (!sentence) return;
      const offset = video.snippet_start_time ?? 0;
      playerRef.current?.seekTo(sentence.startTime + offset);
      activeSentenceIdRef.current = sentenceId;
      setActiveSentenceId(sentenceId);
    },
    [video],
  );

  const handlePlayerStateChange = useCallback((state: string) => {
    if (state === "playing") setPlaying(true);
    else if (state === "paused" || state === "ended") setPlaying(false);
  }, []);

  const handleExit = useCallback(() => {
    router.back();
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

  return (
    <SafeAreaView style={styles.container}>
      <ShadowingHeader
        title={video.title}
        mode={mode}
        onModeChange={handleModeChange}
        onExit={handleExit}
      />
      <YouTubePlayer
        ref={playerRef}
        videoId={video.video_id}
        playing={playing}
        onChangeState={handlePlayerStateChange}
        startSeconds={video.snippet_start_time}
      />
      {sentences.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>자막이 없습니다.</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={sentences}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ShadowingScriptLine
              sentence={item}
              isActive={item.id === activeSentenceId}
              hasRecording={!!recordedSentences[item.id]}
              isCurrentRecording={item.id === currentRecordingSentenceId}
              onRecord={handleRecord}
              onSeek={handleSeek}
              index={index}
            />
          )}
          getItemLayout={(_data, index) => ({
            length: SHADOWING_SCRIPT_LINE_HEIGHT,
            offset: SHADOWING_SCRIPT_LINE_HEIGHT * index,
            index,
          })}
          onScrollToIndexFailed={() => {
            /* ignore scroll failures for short lists */
          }}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}
      <RecordingBar
        recordingState={recordingState}
        duration={duration}
        isPlaying={isPlayingRecording}
        playbackProgress={playbackProgress}
        onStop={handleStop}
        onPlay={playRecording}
        onPause={pauseRecording}
        onReRecord={handleReRecord}
        onConfirm={handleConfirm}
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
  emptyText: {
    fontSize: 15,
    color: "#888",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100, // Space for RecordingBar
  },
});
