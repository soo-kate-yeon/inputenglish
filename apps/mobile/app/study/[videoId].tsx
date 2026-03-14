// @MX:ANCHOR: StudyScreen - unified listening/shadowing hub
// @MX:REASON: [AUTO] fan_in >= 3: navigated from HomeScreen, deeplinks, and study session flow
// @MX:SPEC: SPEC-MOBILE-003, SPEC-MOBILE-004, SPEC-MOBILE-005
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Platform,
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
import type { Sentence, SavedSentence, CuratedVideo } from "@shadowoo/shared";
import { groupSentencesByMode } from "@shadowoo/shared";
import { fetchCuratedVideo } from "../../src/lib/api";
import { appStore, studyStore } from "../../src/lib/stores";
import YouTubePlayer, {
  YouTubePlayerHandle,
} from "../../src/components/player/YouTubePlayer";
import ScriptLine from "../../src/components/listening/ScriptLine";
import ShadowingScriptLine from "../../src/components/shadowing/ShadowingScriptLine";
import RecordingBar from "../../src/components/shadowing/RecordingBar";
import useAudioRecorder from "../../src/hooks/useAudioRecorder";
import { uploadRecording } from "../../src/lib/ai-api";
import { useAuth } from "../../src/contexts/AuthContext";

const C = {
  bg: "#FFFFFF",
  border: "#111111",
  borderLight: "#E0E0E0",
  text: "#111111",
  muted: "#AAAAAA",
};

type MainTab = "listening" | "shadowing";
type ShadowingMode = "sentence" | "paragraph" | "total";
const SHADOWING_MODES: Array<{ key: ShadowingMode; label: string }> = [
  { key: "sentence", label: "SENTENCE" },
  { key: "paragraph", label: "PARAGRAPH" },
  { key: "total", label: "TOTAL" },
];

export default function StudyScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();

  const [video, setVideo] = useState<CuratedVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Shared state
  const [mainTab, setMainTab] = useState<MainTab>("listening");
  const [playing, setPlaying] = useState(false);
  const [scriptVisible, setScriptVisible] = useState(true);
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);

  // Listening state
  const [loopingSentenceId, setLoopingSentenceId] = useState<string | null>(
    null,
  );

  // Shadowing state
  const [shadowingMode, setShadowingMode] = useState<ShadowingMode>("sentence");
  const [shadowingSentences, setShadowingSentences] = useState<Sentence[]>([]);
  const [currentRecordingSentenceId, setCurrentRecordingSentenceId] = useState<
    string | null
  >(null);
  const [recordedSentences, setRecordedSentences] = useState<
    Record<string, string>
  >({});

  const playerRef = useRef<YouTubePlayerHandle>(null);
  const listRef = useRef<FlatList<Sentence>>(null);
  const activeIdRef = useRef<string | null>(null);
  const loopIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stores
  const savedSentences = appStore((s) => s.savedSentences);
  const addSavedSentence = appStore((s) => s.addSavedSentence);
  const removeSavedSentence = appStore((s) => s.removeSavedSentence);
  const { user } = useAuth();

  const {
    recordingState,
    audioUri,
    duration: recDuration,
    isPlaying: isPlayingRec,
    playbackProgress,
    isRecorderBusy,
    lastError,
    startRecording,
    stopRecording,
    playRecording,
    pauseRecording,
    resetRecording,
  } = useAudioRecorder();

  // ── Load video ──
  useEffect(() => {
    if (!videoId) return;
    fetchCuratedVideo(videoId)
      .then((v) => {
        setVideo(v);
        setShadowingSentences(
          groupSentencesByMode(v.transcript ?? [], "sentence"),
        );
        const { sessions, createSession } = studyStore.getState();
        if (!sessions.find((s) => s.videoId === videoId && !s.isCompleted)) {
          createSession(videoId, v.title, v.transcript ?? []);
        }
      })
      .catch((e: Error) => setError(e.message ?? "Failed to load video"))
      .finally(() => setLoading(false));
  }, [videoId]);

  // ── Background pause ──
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") {
        setPlaying(false);
        if (recordingState === "recording") void stopRecording();
      }
    });
    return () => sub.remove();
  }, [recordingState, stopRecording]);

  const handleStateChange = useCallback((state: string) => {
    if (state === "playing") setPlaying(true);
    else if (state === "paused" || state === "ended") setPlaying(false);
  }, []);

  // ── 100ms poll: sentence sync ──
  useEffect(() => {
    if (!playing || !video) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const allSentences = video.transcript ?? [];
    const offset = video.snippet_start_time ?? 0;
    const activeSentences =
      mainTab === "shadowing" ? shadowingSentences : allSentences;

    pollRef.current = setInterval(async () => {
      const t = await playerRef.current?.getCurrentTime();
      if (t === undefined) return;
      const rel = Math.max(0, t - offset);

      // Loop (listening only)
      if (mainTab === "listening") {
        const lid = loopIdRef.current;
        if (lid) {
          const ls = allSentences.find((s) => s.id === lid);
          if (ls && rel >= ls.endTime - 0.08) {
            playerRef.current?.seekTo(ls.startTime + offset);
            return;
          }
        }
      }

      // Active sentence — match against the DISPLAYED list (handles grouped sentences)
      let active: Sentence | undefined;
      for (let i = activeSentences.length - 1; i >= 0; i--) {
        if (
          activeSentences[i].startTime <= rel &&
          rel < activeSentences[i].endTime
        ) {
          active = activeSentences[i];
          break;
        }
      }
      // Fallback: if past the last sentence's endTime, highlight the last one
      if (!active && activeSentences.length > 0) {
        const last = activeSentences[activeSentences.length - 1];
        if (rel >= last.startTime) active = last;
      }
      if (active && active.id !== activeIdRef.current) {
        activeIdRef.current = active.id;
        setActiveSentenceId(active.id);
        const idx = activeSentences.indexOf(active);
        if (idx >= 0) {
          listRef.current?.scrollToIndex({
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
  }, [playing, video, mainTab, shadowingSentences]);

  // ── Listening handlers ──

  const handleSentenceTap = useCallback(
    (sentence: Sentence) => {
      if (seekDebounce.current) clearTimeout(seekDebounce.current);
      seekDebounce.current = setTimeout(() => {
        const offset = video?.snippet_start_time ?? 0;
        playerRef.current?.seekTo(sentence.startTime + offset);
        activeIdRef.current = sentence.id;
        setActiveSentenceId(sentence.id);
      }, 300);
    },
    [video],
  );

  const handleLoopToggle = useCallback((sentence: Sentence) => {
    if (sentence.endTime - sentence.startTime < 0.5) return;
    setLoopingSentenceId((prev) => {
      const next = prev === sentence.id ? null : sentence.id;
      loopIdRef.current = next;
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
        addSavedSentence({
          id: Crypto.randomUUID(),
          videoId,
          sentenceId: sentence.id,
          sentenceText: sentence.text,
          startTime: sentence.startTime,
          endTime: sentence.endTime,
          createdAt: Date.now(),
        } as SavedSentence);
      }
    },
    [videoId, savedSentences, addSavedSentence, removeSavedSentence],
  );

  // ── Shadowing handlers ──

  const handleShadowingModeChange = useCallback(
    (m: ShadowingMode) => {
      setShadowingMode(m);
      if (video?.transcript) {
        setShadowingSentences(groupSentencesByMode(video.transcript, m));
        setActiveSentenceId(null);
        activeIdRef.current = null;
      }
    },
    [video],
  );

  const handleSeek = useCallback(
    (sentenceId: string) => {
      if (!video) return;
      // Search grouped list first (paragraph/total have new ids), then fallback to transcript
      const sentence =
        shadowingSentences.find((s) => s.id === sentenceId) ??
        video.transcript?.find((s) => s.id === sentenceId);
      if (!sentence) return;
      playerRef.current?.seekTo(
        sentence.startTime + (video.snippet_start_time ?? 0),
      );
      activeIdRef.current = sentenceId;
      setActiveSentenceId(sentenceId);
    },
    [video, shadowingSentences],
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
    if (!uri) Alert.alert("Error", lastError ?? "녹음을 저장하지 못했습니다.");
  }, [lastError, stopRecording]);

  const handleConfirm = useCallback(async () => {
    if (!currentRecordingSentenceId || !audioUri) return;
    const sid = currentRecordingSentenceId;
    const uri = audioUri;
    setRecordedSentences((prev) => ({ ...prev, [sid]: uri }));
    setCurrentRecordingSentenceId(null);
    await resetRecording();
    if (user?.id && videoId) {
      uploadRecording(uri, user.id, videoId, sid, recDuration).catch(() => {});
    }
  }, [
    currentRecordingSentenceId,
    audioUri,
    resetRecording,
    user?.id,
    videoId,
    recDuration,
  ]);

  const handleReRecord = useCallback(async () => {
    await resetRecording();
    setCurrentRecordingSentenceId(null);
  }, [resetRecording]);

  // ── Render ──

  if (loading) {
    return (
      <SafeAreaView style={styles.state}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="small" color={C.text} />
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

  const listeningData = video.transcript ?? [];
  const isRecording = recordingState !== "idle";

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

      {/* Main tabs: LISTENING / SHADOWING */}
      <View style={styles.mainTabs}>
        <TouchableOpacity
          style={[
            styles.mainTab,
            mainTab === "listening" && styles.mainTabActive,
          ]}
          onPress={() => setMainTab("listening")}
        >
          <Text
            style={[
              styles.mainTabText,
              mainTab === "listening" && styles.mainTabTextActive,
            ]}
          >
            LISTENING
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.mainTab,
            mainTab === "shadowing" && styles.mainTabActive,
          ]}
          onPress={() => setMainTab("shadowing")}
        >
          <Text
            style={[
              styles.mainTabText,
              mainTab === "shadowing" && styles.mainTabTextActive,
            ]}
          >
            SHADOWING
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sub tabs for shadowing mode */}
      {mainTab === "shadowing" && (
        <View style={styles.subTabs}>
          {SHADOWING_MODES.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.subTab,
                shadowingMode === key && styles.subTabActive,
              ]}
              onPress={() => handleShadowingModeChange(key)}
            >
              <Text
                style={[
                  styles.subTabText,
                  shadowingMode === key && styles.subTabTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Script area */}
      {!scriptVisible ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>SCRIPT HIDDEN</Text>
        </View>
      ) : mainTab === "listening" ? (
        /* ── Listening list ── */
        listeningData.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>NO TRANSCRIPT</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={listeningData}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ScriptLine
                sentence={item}
                isActive={item.id === activeSentenceId}
                isLooping={item.id === loopingSentenceId}
                isSaved={savedSentences.some(
                  (s) => s.sentenceId === item.id && s.videoId === videoId,
                )}
                scriptHidden={false}
                onTap={handleSentenceTap}
                onLoopToggle={handleLoopToggle}
                onSaveToggle={handleSaveToggle}
              />
            )}
            onScrollToIndexFailed={() => {}}
            style={styles.list}
            contentContainerStyle={styles.listContent}
          />
        )
      ) : /* ── Shadowing list ── */
      shadowingSentences.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>NO TRANSCRIPT</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={shadowingSentences}
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

      {/* Recording bar (shadowing, when recording) */}
      {mainTab === "shadowing" && isRecording ? (
        <RecordingBar
          recordingState={recordingState}
          duration={recDuration}
          isPlaying={isPlayingRec}
          playbackProgress={playbackProgress}
          onStop={handleStop}
          onPlay={playRecording}
          onPause={pauseRecording}
          onReRecord={handleReRecord}
          onConfirm={handleConfirm}
        />
      ) : null}

      {/* Bottom bar: script toggle (left) + end CTA (right) */}
      {!isRecording ? (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.bottomBtn}
            onPress={() => setScriptVisible((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={scriptVisible ? "document-text" : "document-text-outline"}
              size={18}
              color={C.text}
            />
            <Text style={styles.bottomBtnText}>
              {scriptVisible ? "HIDE SCRIPT" : "SHOW SCRIPT"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.endBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.endBtnText}>END</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  state: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: { fontSize: 13, letterSpacing: 1, color: C.muted },

  // Main tabs
  mainTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  mainTab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  mainTabActive: { borderBottomColor: C.border },
  mainTabText: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    color: C.muted,
  },
  mainTabTextActive: { color: C.text },

  // Sub tabs (shadowing modes)
  subTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  subTab: { flex: 1, paddingVertical: 8, alignItems: "center" },
  subTabActive: { backgroundColor: C.text },
  subTabText: {
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
    color: C.muted,
  },
  subTabTextActive: { color: C.bg },

  // Script
  list: { flex: 1 },
  listContent: { paddingBottom: 16 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: {
    fontSize: 11,
    letterSpacing: 3,
    color: C.muted,
    fontWeight: "600",
  },

  // Bottom bar
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingVertical: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    backgroundColor: C.bg,
  },
  bottomBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  bottomBtnText: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    color: C.text,
  },
  endBtn: {
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  endBtnText: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    color: C.text,
  },
});
