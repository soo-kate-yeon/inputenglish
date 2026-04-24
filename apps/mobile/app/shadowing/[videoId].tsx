// @MX:ANCHOR: ShadowingScreen - core YouTube + script + recording screen
// @MX:REASON: [AUTO] fan_in >= 3: navigated from HomeScreen, deeplinks, and study flow
// @MX:SPEC: SPEC-MOBILE-004 - REQ-U-001 through REQ-C-002
// @MX:NOTE: [AUTO] SPEC-MOBILE-006 additions: AI panel (DifficultyTagSelector, AiTipButton, AiTipCard)
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { Sentence, CuratedVideo } from "@inputenglish/shared";
import { groupSentencesByMode } from "@inputenglish/shared";
import { fetchCuratedVideo } from "../../src/lib/api";
import { studyStore } from "../../src/lib/stores";
import YouTubePlayer, {
  YouTubePlayerHandle,
} from "../../src/components/player/YouTubePlayer";
import ShadowingHeader, {
  ShadowingMode,
} from "../../src/components/shadowing/ShadowingHeader";
import { ExerciseRecordingBar } from "../../src/components/study/carousel/ExerciseRecordingBar";
import useAudioRecorder from "../../src/hooks/useAudioRecorder";
import { uploadRecording } from "../../src/lib/ai-api";
import { useAuth } from "../../src/contexts/AuthContext";
import { colors, font, radius, spacing } from "../../src/theme";

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

  const { user } = useAuth();

  // Load video
  useEffect(() => {
    if (!videoId) return;
    fetchCuratedVideo(videoId)
      .then((v) => {
        const groupedSentences = groupSentencesByMode(
          v.transcript ?? [],
          "sentence",
        );
        setVideo(v);
        setSentences(groupedSentences);
        const firstSentence = groupedSentences[0] ?? null;
        setActiveSentenceId(firstSentence?.id ?? null);
        activeIdRef.current = firstSentence?.id ?? null;
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
    if (!playing || !sentences.length || !video) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const offset = video.snippet_start_time ?? 0;

    pollRef.current = setInterval(async () => {
      const t = await playerRef.current?.getCurrentTime();
      if (t === undefined) return;
      const rel = t - offset;

      if (mode !== "total" && activeIdRef.current) {
        const loopingSegment = sentences.find(
          (item) => item.id === activeIdRef.current,
        );
        if (
          loopingSegment &&
          rel >= Math.max(loopingSegment.endTime - 0.05, 0)
        ) {
          playerRef.current?.seekTo(loopingSegment.startTime + offset);
          return;
        }
      }

      let activeSegment: Sentence | undefined;
      for (let i = sentences.length - 1; i >= 0; i--) {
        if (sentences[i].startTime <= rel) {
          activeSegment = sentences[i];
          break;
        }
      }
      if (activeSegment && activeSegment.id !== activeIdRef.current) {
        activeIdRef.current = activeSegment.id;
        setActiveSentenceId(activeSegment.id);
      }
    }, 100);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [mode, playing, video, sentences]);

  const handleStateChange = useCallback(
    (state: string) => {
      if (state === "playing") {
        setPlaying(true);
        return;
      }

      if (
        state === "ended" &&
        mode !== "total" &&
        activeIdRef.current &&
        video
      ) {
        const loopingSegment = sentences.find(
          (item) => item.id === activeIdRef.current,
        );
        if (loopingSegment) {
          const offset = video.snippet_start_time ?? 0;
          playerRef.current?.seekTo(loopingSegment.startTime + offset);
          setPlaying(true);
          return;
        }
      }

      if (state === "paused" || state === "ended") {
        setPlaying(false);
      }
    },
    [mode, sentences, video],
  );

  const handleModeChange = useCallback(
    (newMode: ShadowingMode) => {
      if (!video?.transcript) return;
      const groupedSentences = groupSentencesByMode(video.transcript, newMode);
      const firstSentence = groupedSentences[0] ?? null;
      const offset = video.snippet_start_time ?? 0;

      setMode(newMode);
      setSentences(groupedSentences);
      setCurrentRecordingSentenceId(null);
      setActiveSentenceId(firstSentence?.id ?? null);
      activeIdRef.current = firstSentence?.id ?? null;

      if (firstSentence) {
        playerRef.current?.seekTo(firstSentence.startTime + offset);
        setPlaying(true);
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
    if (audioUri && currentRecordingSentenceId) {
      const sid = currentRecordingSentenceId;
      const uri = audioUri;
      setRecordedSentences((prev) => ({ ...prev, [sid]: uri }));
      if (user?.id && videoId) {
        uploadRecording(uri, user.id, videoId, sid, duration).catch(() => {});
      }
    }
    setCurrentRecordingSentenceId(null);
    await resetRecording();
  }, [
    audioUri,
    currentRecordingSentenceId,
    duration,
    resetRecording,
    user?.id,
    videoId,
  ]);

  const handleSeek = useCallback(
    (sentenceId: string) => {
      if (!video) return;
      const sentence =
        sentences.find((item) => item.id === sentenceId) ??
        video.transcript?.find((item) => item.id === sentenceId);
      if (!sentence) return;
      const offset = video.snippet_start_time ?? 0;
      playerRef.current?.seekTo(sentence.startTime + offset);
      activeIdRef.current = sentenceId;
      setActiveSentenceId(sentenceId);
      setPlaying(true);
    },
    [sentences, video],
  );

  const currentIndex = Math.max(
    sentences.findIndex((item) => item.id === activeSentenceId),
    0,
  );
  const currentSentence = sentences[currentIndex] ?? null;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < sentences.length - 1;

  const moveToAdjacent = useCallback(
    (direction: "prev" | "next") => {
      if (!sentences.length) return;
      const nextIndex =
        direction === "prev"
          ? Math.max(currentIndex - 1, 0)
          : Math.min(currentIndex + 1, sentences.length - 1);
      const nextSentence = sentences[nextIndex];
      if (!nextSentence) return;
      handleSeek(nextSentence.id);
    },
    [currentIndex, handleSeek, sentences],
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

      <View style={styles.hiddenPlayer}>
        <YouTubePlayer
          ref={playerRef}
          videoId={video.video_id}
          playing={playing}
          onChangeState={handleStateChange}
          startSeconds={video.snippet_start_time}
        />
      </View>

      <ShadowingHeader
        title={video.title}
        mode={mode}
        onModeChange={handleModeChange}
        onExit={() => router.back()}
      />

      <View style={styles.content}>
        {!scriptVisible ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>스크립트가 숨겨져 있어요</Text>
            <Text style={styles.emptySubtitle}>
              소리만 듣고 따라 말해보세요. 필요할 때만 스크립트를 열어서
              확인하면 더 집중하기 쉬워요.
            </Text>
          </View>
        ) : !currentSentence ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>스크립트가 없어요</Text>
            <Text style={styles.emptySubtitle}>
              이 영상에는 쉐도잉에 사용할 스크립트가 아직 준비되지 않았어요.
            </Text>
          </View>
        ) : (
          <View style={styles.focusBody}>
            <View style={styles.focusMetaRow}>
              <Text style={styles.focusMeta}>
                {mode === "sentence"
                  ? "문장 집중"
                  : mode === "paragraph"
                    ? "문단 집중"
                    : "전체 따라 말하기"}
              </Text>
              <Text style={styles.focusCount}>
                {currentIndex + 1} / {sentences.length}
              </Text>
            </View>

            <Pressable
              style={styles.scriptBlock}
              onPress={() => handleSeek(currentSentence.id)}
            >
              <Text style={styles.scriptText}>{currentSentence.text}</Text>
              {currentSentence.translation ? (
                <Text style={styles.translationText}>
                  {currentSentence.translation}
                </Text>
              ) : null}
            </Pressable>

            <ExerciseRecordingBar
              recordingState={recordingState}
              duration={duration}
              isPlaying={isPlayingRecording}
              playbackProgress={playbackProgress}
              onStart={
                currentSentence
                  ? () => handleRecord(currentSentence.id)
                  : undefined
              }
              onStop={handleStop}
              onPlay={playRecording}
              onPause={pauseRecording}
              onReRecord={handleReRecord}
              onConfirm={handleConfirm}
            />
          </View>
        )}

        {recordingState === "idle" && (
          <View style={styles.idleFooter}>
            <View style={styles.navRow}>
              <Pressable
                style={[styles.navButton, !hasPrev && styles.navButtonDisabled]}
                onPress={() => moveToAdjacent("prev")}
                disabled={!hasPrev}
              >
                <Text
                  style={[
                    styles.navButtonText,
                    !hasPrev && styles.navButtonTextDisabled,
                  ]}
                >
                  이전
                </Text>
              </Pressable>

              <Pressable
                style={[styles.navButton, !hasNext && styles.navButtonDisabled]}
                onPress={() => moveToAdjacent("next")}
                disabled={!hasNext}
              >
                <Text
                  style={[
                    styles.navButtonText,
                    !hasNext && styles.navButtonTextDisabled,
                  ]}
                >
                  다음
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.scriptToggle}
              onPress={() => setScriptVisible((v) => !v)}
            >
              <Text style={styles.scriptToggleText}>
                {scriptVisible ? "스크립트 숨기기" : "스크립트 보기"}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
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

  hiddenPlayer: {
    position: "absolute",
    left: -9999,
    top: 0,
    opacity: 0.01,
  },
  content: {
    flex: 1,
  },
  focusBody: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 96,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: font.size.lg,
    lineHeight: 28,
    color: colors.text,
    fontWeight: font.weight.bold,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: font.size.sm,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: "center",
  },
  focusMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  focusMeta: {
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textMuted,
    fontWeight: font.weight.semibold,
  },
  focusCount: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: font.weight.medium,
  },
  scriptBlock: {
    flex: 1,
    justifyContent: "center",
  },
  scriptText: {
    fontSize: 30,
    lineHeight: 42,
    color: colors.text,
    fontWeight: font.weight.bold,
    letterSpacing: -0.4,
  },
  translationText: {
    marginTop: spacing.lg,
    fontSize: font.size.base,
    lineHeight: 28,
    color: colors.textSecondary,
  },
  idleFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 28,
    gap: spacing.md,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  navButton: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonDisabled: {
    borderColor: colors.border,
  },
  navButtonText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  navButtonTextDisabled: {
    color: colors.textMuted,
  },
  scriptToggle: {
    alignSelf: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  scriptToggleText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: font.weight.semibold,
  },
});
