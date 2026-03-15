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
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import type {
  CuratedVideo,
  PracticeCoachingSummary,
  PracticeMode,
  PracticePrompt,
  SavedSentence,
  Sentence,
} from "@shadowoo/shared";
import { groupSentencesByMode } from "@shadowoo/shared";
import {
  ensurePracticePrompts,
  fetchCuratedVideo,
  fetchLearningSessionDetail,
  savePlaybookEntry,
  savePracticeAttempt,
  type SessionListItem,
} from "../../src/lib/api";
import { appStore, studyStore } from "../../src/lib/stores";
import YouTubePlayer, {
  YouTubePlayerHandle,
} from "../../src/components/player/YouTubePlayer";
import ScriptLine from "../../src/components/listening/ScriptLine";
import ShadowingScriptLine from "../../src/components/shadowing/ShadowingScriptLine";
import RecordingBar from "../../src/components/shadowing/RecordingBar";
import ContextBriefCard from "../../src/components/study/ContextBriefCard";
import TransformationPracticePanel from "../../src/components/study/TransformationPracticePanel";
import useAudioRecorder from "../../src/hooks/useAudioRecorder";
import { getPronunciationScore, uploadRecording } from "../../src/lib/ai-api";
import { trackEvent } from "../../src/lib/analytics";
import {
  buildPracticeDraft,
  generateRewriteCoaching,
  generateVoiceCoachingSummary,
} from "../../src/lib/professional-practice";
import { useAuth } from "../../src/contexts/AuthContext";
import { useSubscription } from "../../src/hooks/useSubscription";

const C = {
  bg: "#FFFFFF",
  border: "#111111",
  borderLight: "#E0E0E0",
  text: "#111111",
  muted: "#AAAAAA",
};

type MainTab = "listening" | "shadowing" | "transformation";
type ShadowingMode = "sentence" | "paragraph" | "total";
const SHADOWING_MODES: Array<{ key: ShadowingMode; label: string }> = [
  { key: "sentence", label: "문장" },
  { key: "paragraph", label: "문단" },
  { key: "total", label: "전체" },
];

function resolveStudySentences(
  video: CuratedVideo | null,
  sessionDetail: SessionListItem | null,
): Sentence[] {
  const transcript = video?.transcript ?? [];
  const sentenceIds = sessionDetail?.sentence_ids ?? [];

  if (sentenceIds.length === 0) {
    return transcript;
  }

  return sentenceIds
    .map((sentenceId) =>
      transcript.find((sentence) => sentence.id === sentenceId),
    )
    .filter((sentence): sentence is Sentence => Boolean(sentence));
}

export default function StudyScreen() {
  const { videoId, sessionId } = useLocalSearchParams<{
    videoId: string;
    sessionId?: string;
  }>();

  const [video, setVideo] = useState<CuratedVideo | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionListItem | null>(
    null,
  );
  const [practicePrompts, setPracticePrompts] = useState<PracticePrompt[]>([]);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("slot-in");
  const [selectedPracticeSentenceId, setSelectedPracticeSentenceId] = useState<
    string | null
  >(null);
  const [practiceDraft, setPracticeDraft] = useState("");
  const [coachingSummary, setCoachingSummary] =
    useState<PracticeCoachingSummary | null>(null);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [voiceCoachingLoading, setVoiceCoachingLoading] = useState(false);
  const [playbookMessage, setPlaybookMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefExpanded, setBriefExpanded] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [uploadedRecordingUrls, setUploadedRecordingUrls] = useState<
    Record<string, string>
  >({});

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
  const { plan } = useSubscription();
  const studySentences = resolveStudySentences(video, sessionDetail);
  const playerBaseOffset = video?.snippet_start_time ?? 0;
  const sessionStartTime =
    sessionDetail?.start_time ?? studySentences[0]?.startTime ?? 0;
  const sessionEndTime =
    sessionDetail?.end_time ??
    studySentences[studySentences.length - 1]?.endTime ??
    video?.snippet_duration ??
    0;
  const playerStartSeconds = playerBaseOffset + sessionStartTime;

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
    Promise.all([
      fetchCuratedVideo(videoId),
      sessionId ? fetchLearningSessionDetail(sessionId) : Promise.resolve(null),
    ])
      .then(([v, detail]) => {
        setVideo(v);
        setSessionDetail(detail);
        const initialSentences = resolveStudySentences(v, detail);
        setSelectedPracticeSentenceId(initialSentences[0]?.id ?? null);
        setShadowingSentences(
          groupSentencesByMode(initialSentences, "sentence"),
        );
        const { sessions, createSession } = studyStore.getState();
        if (!sessions.find((s) => s.videoId === videoId && !s.isCompleted)) {
          createSession(videoId, v.title, initialSentences);
        }
      })
      .catch((e: Error) => setError(e.message ?? "Failed to load video"))
      .finally(() => setLoading(false));
  }, [videoId, sessionId]);

  useEffect(() => {
    if (!sessionDetail) return;
    setBriefExpanded(true);
    setPracticePrompts([]);
    setPracticeMode("slot-in");
    setPracticeDraft("");
    setCoachingSummary(null);
    setPlaybookMessage(null);
    trackEvent("context_open", {
      sessionId: sessionDetail.id,
      premiumRequired: sessionDetail.premium_required,
      speakingFunction: sessionDetail.speaking_function,
    });
  }, [sessionDetail]);

  useEffect(() => {
    if (
      mainTab !== "transformation" ||
      !sessionDetail ||
      practicePrompts.length
    ) {
      return;
    }

    setPracticeLoading(true);
    ensurePracticePrompts(
      sessionDetail,
      user?.user_metadata?.full_name || user?.email || null,
    )
      .then(setPracticePrompts)
      .catch((loadError) => {
        console.error(
          "[StudyScreen] Failed to load practice prompts:",
          loadError,
        );
      })
      .finally(() => setPracticeLoading(false));
  }, [
    mainTab,
    practicePrompts.length,
    sessionDetail,
    user?.email,
    user?.user_metadata?.full_name,
  ]);

  useEffect(() => {
    if (studySentences.length === 0) return;
    const sourceSentence =
      studySentences.find(
        (sentence) => sentence.id === selectedPracticeSentenceId,
      ) ?? studySentences[0];
    const activePrompt = practicePrompts.find(
      (prompt) => prompt.mode === practiceMode,
    );

    setPracticeDraft(
      buildPracticeDraft(practiceMode, sourceSentence.text, activePrompt),
    );
    setCoachingSummary(null);
    setPlaybookMessage(null);
  }, [
    practiceMode,
    practicePrompts,
    selectedPracticeSentenceId,
    studySentences,
  ]);

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
    const allSentences = studySentences;
    const offset = playerBaseOffset;
    const activeSentences =
      mainTab === "shadowing" ? shadowingSentences : allSentences;

    pollRef.current = setInterval(async () => {
      const t = await playerRef.current?.getCurrentTime();
      if (t === undefined) return;
      const rel = Math.max(0, t - offset);

      if (sessionEndTime > 0 && rel >= sessionEndTime) {
        setPlaying(false);
        playerRef.current?.seekTo(playerStartSeconds);
        return;
      }

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
  }, [
    mainTab,
    playerBaseOffset,
    playerStartSeconds,
    playing,
    sessionEndTime,
    shadowingSentences,
    studySentences,
    video,
  ]);

  // ── Listening handlers ──

  const handleSentenceTap = useCallback(
    (sentence: Sentence) => {
      if (seekDebounce.current) clearTimeout(seekDebounce.current);
      seekDebounce.current = setTimeout(() => {
        const offset = playerBaseOffset;
        playerRef.current?.seekTo(sentence.startTime + offset);
        activeIdRef.current = sentence.id;
        setActiveSentenceId(sentence.id);
      }, 300);
    },
    [playerBaseOffset],
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
      if (studySentences.length > 0) {
        setShadowingSentences(groupSentencesByMode(studySentences, m));
        setActiveSentenceId(null);
        activeIdRef.current = null;
      }
    },
    [studySentences],
  );

  const handleSeek = useCallback(
    (sentenceId: string) => {
      // Search grouped list first (paragraph/total have new ids), then fallback to transcript
      const sentence =
        shadowingSentences.find((s) => s.id === sentenceId) ??
        studySentences.find((s) => s.id === sentenceId);
      if (!sentence) return;
      playerRef.current?.seekTo(sentence.startTime + playerBaseOffset);
      activeIdRef.current = sentenceId;
      setActiveSentenceId(sentenceId);
    },
    [playerBaseOffset, shadowingSentences, studySentences],
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
      uploadRecording(uri, user.id, videoId, sid, recDuration)
        .then((publicUrl) => {
          setUploadedRecordingUrls((prev) => ({ ...prev, [sid]: publicUrl }));
        })
        .catch(() => {});
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

  const handleTransformationTabPress = useCallback(() => {
    if (plan === "FREE") {
      router.push("/paywall");
      return;
    }

    setMainTab("transformation");
  }, [plan]);

  const handlePracticeModeChange = useCallback((mode: PracticeMode) => {
    setPracticeMode(mode);
  }, []);

  const handlePracticeSentenceChange = useCallback((sentenceId: string) => {
    setSelectedPracticeSentenceId(sentenceId);
  }, []);

  const handlePracticeCoach = useCallback(async () => {
    if (!sessionDetail || studySentences.length === 0) return;

    const sourceSentence =
      studySentences.find(
        (sentence) => sentence.id === selectedPracticeSentenceId,
      ) ?? studySentences[0];

    const summary = generateRewriteCoaching({
      sourceSentence: sourceSentence.text,
      rewrite: practiceDraft,
      mode: practiceMode,
      speakingFunction: sessionDetail.speaking_function,
    });

    setCoachingLoading(true);
    setCoachingSummary(summary);
    setPlaybookMessage(null);

    try {
      if (user?.id) {
        await savePracticeAttempt(user.id, {
          sessionId: sessionDetail.id,
          sourceVideoId: sessionDetail.source_video_id,
          sourceSentence: sourceSentence.text,
          speakingFunction: sessionDetail.speaking_function,
          mode: practiceMode,
          responseText: practiceDraft,
          coachingSummary: summary,
          attemptMetadata: {
            promptTitle:
              practicePrompts.find((prompt) => prompt.mode === practiceMode)
                ?.title ?? null,
          },
        });
      }
    } catch (attemptError) {
      console.error(
        "[StudyScreen] Failed to save practice attempt:",
        attemptError,
      );
    } finally {
      setCoachingLoading(false);
    }
  }, [
    practiceDraft,
    practiceMode,
    practicePrompts,
    selectedPracticeSentenceId,
    sessionDetail,
    studySentences,
    user?.id,
  ]);

  const handleVoiceCoaching = useCallback(async () => {
    if (!sessionDetail || studySentences.length === 0) return;

    const sourceSentence =
      studySentences.find(
        (sentence) => sentence.id === selectedPracticeSentenceId,
      ) ?? studySentences[0];
    const recordingUrl = uploadedRecordingUrls[sourceSentence.id];
    if (!recordingUrl) return;

    setVoiceCoachingLoading(true);
    setPlaybookMessage(null);

    try {
      const result = await getPronunciationScore(
        recordingUrl,
        sourceSentence.text,
      );
      const summary = generateVoiceCoachingSummary(result);
      setCoachingSummary(summary);

      if (user?.id) {
        await savePracticeAttempt(user.id, {
          sessionId: sessionDetail.id,
          sourceVideoId: sessionDetail.source_video_id,
          sourceSentence: sourceSentence.text,
          speakingFunction: sessionDetail.speaking_function,
          mode: practiceMode,
          responseText: practiceDraft,
          recordingUrl,
          coachingSummary: summary,
          attemptMetadata: { source: "shadowing-recording" },
        });
      }
    } catch (voiceError) {
      console.error(
        "[StudyScreen] Failed to generate voice coaching:",
        voiceError,
      );
    } finally {
      setVoiceCoachingLoading(false);
    }
  }, [
    practiceDraft,
    practiceMode,
    selectedPracticeSentenceId,
    sessionDetail,
    studySentences,
    uploadedRecordingUrls,
    user?.id,
  ]);

  const handleSavePlaybook = useCallback(async () => {
    if (!sessionDetail || studySentences.length === 0 || !user?.id) return;

    const sourceSentence =
      studySentences.find(
        (sentence) => sentence.id === selectedPracticeSentenceId,
      ) ?? studySentences[0];
    const summary =
      coachingSummary ??
      generateRewriteCoaching({
        sourceSentence: sourceSentence.text,
        rewrite: practiceDraft,
        mode: practiceMode,
        speakingFunction: sessionDetail.speaking_function,
      });

    try {
      await savePlaybookEntry(user.id, {
        sessionId: sessionDetail.id,
        sourceVideoId: sessionDetail.source_video_id,
        sourceSentence: sourceSentence.text,
        speakingFunction: sessionDetail.speaking_function,
        practiceMode,
        userRewrite: practiceDraft,
        attemptMetadata: {
          coachingSummary: summary,
          promptTitle:
            practicePrompts.find((prompt) => prompt.mode === practiceMode)
              ?.title ?? null,
        },
      });
      setPlaybookMessage(
        "플레이북에 저장했어요. 보관함 > 플레이북에서 다시 볼 수 있어요.",
      );
      setCoachingSummary(summary);
    } catch (saveError) {
      console.error("[StudyScreen] Failed to save playbook entry:", saveError);
    }
  }, [
    coachingSummary,
    practiceDraft,
    practiceMode,
    practicePrompts,
    selectedPracticeSentenceId,
    sessionDetail,
    studySentences,
    user?.id,
  ]);

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

  const listeningData = studySentences;
  const isRecording = recordingState !== "idle";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Video player */}
      <YouTubePlayer
        ref={playerRef}
        videoId={video.video_id}
        playing={playing}
        onChangeState={handleStateChange}
        startSeconds={playerStartSeconds}
      />

      {briefExpanded ? (
        <>
          <ScrollView
            style={styles.briefScroll}
            contentContainerStyle={styles.briefScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ContextBriefCard
              context={sessionDetail?.context ?? null}
              locked={Boolean(
                sessionDetail?.premium_required && plan === "FREE",
              )}
              onUnlock={() => router.push("/paywall")}
            />
          </ScrollView>

          {/* Fixed bottom CTA */}
          <View style={styles.briefCta}>
            <TouchableOpacity
              style={styles.briefCtaButton}
              onPress={() => {
                if (!hasStarted && sessionDetail) {
                  trackEvent("session_start", {
                    sessionId: sessionDetail.id,
                    sourceType: sessionDetail.source_type,
                    speakingFunction: sessionDetail.speaking_function,
                  });
                  setHasStarted(true);
                }
                setBriefExpanded(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.briefCtaText}>
                {hasStarted ? "학습 계속하기" : "학습 시작"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      {briefExpanded ? null : (
        <>
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
                리스닝
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
                쉐도잉
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.mainTab,
                mainTab === "transformation" && styles.mainTabActive,
              ]}
              onPress={handleTransformationTabPress}
            >
              <Text
                style={[
                  styles.mainTabText,
                  mainTab === "transformation" && styles.mainTabTextActive,
                ]}
              >
                변형 연습
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
          {mainTab === "transformation" ? (
            <TransformationPracticePanel
              prompts={practicePrompts}
              sentences={studySentences}
              selectedMode={practiceMode}
              selectedSentenceId={selectedPracticeSentenceId}
              draftText={practiceDraft}
              speakingFunction={sessionDetail?.speaking_function}
              coachingSummary={coachingSummary}
              coachingLoading={coachingLoading || practiceLoading}
              voiceCoachingLoading={voiceCoachingLoading}
              saveMessage={playbookMessage}
              canRunVoiceCoaching={Boolean(
                selectedPracticeSentenceId &&
                uploadedRecordingUrls[selectedPracticeSentenceId],
              )}
              onModeChange={handlePracticeModeChange}
              onSentenceChange={handlePracticeSentenceChange}
              onDraftChange={setPracticeDraft}
              onCoach={handlePracticeCoach}
              onVoiceCoach={handleVoiceCoaching}
              onSave={handleSavePlaybook}
            />
          ) : !scriptVisible ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>스크립트가 숨겨져 있어요</Text>
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

          {/* Bottom bar: brief + script icons (left) + end CTA (right) */}
          {!isRecording ? (
            <View style={styles.bottomBar}>
              <View style={styles.bottomLeft}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setBriefExpanded(true)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="reader-outline" size={20} color={C.text} />
                </TouchableOpacity>
                {mainTab !== "transformation" ? (
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => setScriptVisible((v) => !v)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={
                        scriptVisible
                          ? "chatbox-ellipses"
                          : "chatbox-ellipses-outline"
                      }
                      size={20}
                      color={C.text}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.endBtn}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Text style={styles.endBtnText}>END</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      )}
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

  // Brief scroll + fixed CTA
  briefScroll: {
    flex: 1,
  },
  briefScrollContent: {
    paddingBottom: 16,
  },
  briefCta: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    backgroundColor: C.bg,
  },
  briefCtaButton: {
    backgroundColor: C.border,
    paddingVertical: 14,
    alignItems: "center",
  },
  briefCtaText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.bg,
    letterSpacing: 1.5,
  },

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
  bottomLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.borderLight,
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
