// @MX:ANCHOR: ShadowingScreen - core YouTube + script + recording screen
// @MX:REASON: [AUTO] fan_in >= 3: navigated from HomeScreen, deeplinks, and study flow
// @MX:SPEC: SPEC-MOBILE-004 - REQ-U-001 through REQ-C-002
// @MX:NOTE: [AUTO] SPEC-MOBILE-006 additions: AI panel (DifficultyTagSelector, AiTipButton, AiTipCard)
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import type { Sentence, CuratedVideo } from "@inputenglish/shared";
import { groupSentencesByMode } from "@inputenglish/shared";
import { fetchCuratedVideo } from "../../src/lib/api";
import { studyStore, appStore } from "../../src/lib/stores";
import YouTubePlayer, {
  YouTubePlayerHandle,
} from "../../src/components/player/YouTubePlayer";
import ShadowingHeader, {
  ShadowingMode,
} from "../../src/components/shadowing/ShadowingHeader";
import ShadowingScriptLine from "../../src/components/shadowing/ShadowingScriptLine";
import RecordingBar from "../../src/components/shadowing/RecordingBar";
import useAudioRecorder from "../../src/hooks/useAudioRecorder";
import { uploadRecording } from "../../src/lib/ai-api";
import { useAuth } from "../../src/contexts/AuthContext";
import { colors, radius, font } from "../../src/theme";

export default function ShadowingScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();

  const [video, setVideo] = useState<CuratedVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [scriptVisible, setScriptVisible] = useState(true);
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);
  const [currentRecordingSentenceId, setCurrentRecordingSentenceId] = useState<
    string | null
  >(null);
  const [recordedSentences, setRecordedSentences] = useState<
    Record<string, string>
  >({});
  const [mode, setMode] = useState<ShadowingMode>("sentence");
  const [sentences, setSentences] = useState<Sentence[]>([]);

  const playerRef = useRef<YouTubePlayerHandle>(null);
  const flatListRef = useRef<FlatList<Sentence>>(null);
  const activeIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    recordingState,
    audioUri,
    duration,
    isPlaying: isPlayingRecording,
    playbackProgress,
    isRecorderBusy,
    lastError,
    startRecording,
    stopRecording,
    playRecording,
    pauseRecording,
    resetRecording,
  } = useAudioRecorder();

  const currentSession = studyStore((s) => s.currentSession);
  const { user } = useAuth();

  // Load video
  useEffect(() => {
    if (!videoId) return;
    fetchCuratedVideo(videoId)
      .then((v) => {
        setVideo(v);
        setSentences(groupSentencesByMode(v.transcript ?? [], "sentence"));
      })
      .catch((e: Error) => setError(e.message ?? "Failed to load video"))
      .finally(() => setLoading(false));

    const session = studyStore.getState().currentSession;
    if (session)
      studyStore.getState().updateSessionPhase(session.id, "shadowing");
  }, [videoId]);

  // Background pause + stop recording
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        setPlaying(false);
        if (recordingState === "recording") void stopRecording();
      }
    });
    return () => sub.remove();
  }, [recordingState, stopRecording]);

  // 100ms poll: sentence sync
  useEffect(() => {
    if (!playing || !video?.transcript?.length) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const allSentences = video.transcript;
    const offset = video.snippet_start_time ?? 0;

    pollRef.current = setInterval(async () => {
      const t = await playerRef.current?.getCurrentTime();
      if (t === undefined) return;
      const rel = t - offset;

      let active: (typeof allSentences)[0] | undefined;
      for (let i = allSentences.length - 1; i >= 0; i--) {
        if (allSentences[i].startTime <= rel) {
          active = allSentences[i];
          break;
        }
      }
      if (active && active.id !== activeIdRef.current) {
        activeIdRef.current = active.id;
        setActiveSentenceId(active.id);
        const idx = sentences.indexOf(active);
        if (idx >= 0) {
          flatListRef.current?.scrollToIndex({
            index: idx,
            animated: true,
            viewOffset: 60,
          });
        }
      }
    }, 100);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [playing, video, sentences]);

  const handleStateChange = useCallback((state: string) => {
    if (state === "playing") setPlaying(true);
    else if (state === "paused" || state === "ended") setPlaying(false);
  }, []);

  const handleModeChange = useCallback(
    (newMode: ShadowingMode) => {
      setMode(newMode);
      if (video?.transcript) {
        setSentences(groupSentencesByMode(video.transcript, newMode));
        setActiveSentenceId(null);
        activeIdRef.current = null;
      }
    },
    [video],
  );

  const handleRecord = useCallback(
    async (sentenceId: string) => {
      if (isRecorderBusy || recordingState === "recording") return;
      setPlaying(false);
      const started = await startRecording();
      setCurrentRecordingSentenceId(started ? sentenceId : null);
    },
    [isRecorderBusy, recordingState, startRecording],
  );

  const handleStop = useCallback(async () => {
    const uri = await stopRecording();
    if (!uri)
      Alert.alert(
        "녹음을 중지할 수 없어요",
        lastError ?? "녹음을 정상적으로 저장하지 못했습니다.",
      );
  }, [lastError, stopRecording]);

  const handleConfirm = useCallback(async () => {
    if (!currentRecordingSentenceId || !audioUri) {
      Alert.alert("오류", "녹음 파일이 없습니다.");
      return;
    }
    const sid = currentRecordingSentenceId;
    const uri = audioUri;
    setRecordedSentences((prev) => ({ ...prev, [sid]: uri }));
    setCurrentRecordingSentenceId(null);
    await resetRecording();
    if (user?.id && videoId) {
      uploadRecording(uri, user.id, videoId, sid, duration).catch(() => {});
    }
  }, [
    currentRecordingSentenceId,
    audioUri,
    resetRecording,
    user?.id,
    videoId,
    duration,
  ]);

  const handleReRecord = useCallback(async () => {
    await resetRecording();
    setCurrentRecordingSentenceId(null);
  }, [resetRecording]);

  const handleSeek = useCallback(
    (sentenceId: string) => {
      if (!video) return;
      const sentence = video.transcript?.find((s) => s.id === sentenceId);
      if (!sentence) return;
      const offset = video.snippet_start_time ?? 0;
      playerRef.current?.seekTo(sentence.startTime + offset);
      activeIdRef.current = sentenceId;
      setActiveSentenceId(sentenceId);
    },
    [video],
  );

  // --- Render ---

  if (loading) {
    return (
      <SafeAreaView style={styles.state}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="small" color={colors.text} />
      </SafeAreaView>
    );
  }

  if (error || !video) {
    return (
      <SafeAreaView style={styles.state}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.stateText}>
          {error ?? "영상을 불러올 수 없습니다."}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Video player */}
      <YouTubePlayer
        ref={playerRef}
        videoId={video.video_id}
        playing={playing}
        onChangeState={handleStateChange}
        startSeconds={video.snippet_start_time}
      />

      {/* Mode tabs */}
      <ShadowingHeader
        title={video.title}
        mode={mode}
        onModeChange={handleModeChange}
        onExit={() => router.back()}
      />

      {/* Script area */}
      {!scriptVisible ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>SCRIPT HIDDEN</Text>
        </View>
      ) : sentences.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>NO TRANSCRIPT</Text>
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
          onScrollToIndexFailed={() => {}}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Recording bar */}
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

      {/* Bottom bar — script toggle */}
      {recordingState === "idle" ? (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.scriptToggle}
            onPress={() => setScriptVisible((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={scriptVisible ? "document-text" : "document-text-outline"}
              size={18}
              color={colors.text}
            />
            <Text style={styles.scriptToggleText}>
              {scriptVisible ? "HIDE SCRIPT" : "SHOW SCRIPT"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  state: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: { fontSize: 13, letterSpacing: 1, color: colors.textMuted },

  list: { flex: 1 },
  listContent: { paddingBottom: 16 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: {
    fontSize: 11,
    letterSpacing: 3,
    color: colors.textMuted,
    fontWeight: font.weight.semibold,
  },

  aiPanel: {
    backgroundColor: colors.bgSubtle,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 8,
  },

  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.bg,
    alignItems: "center",
  },
  scriptToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
  },
  scriptToggleText: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: font.weight.semibold,
    color: colors.text,
  },
});
