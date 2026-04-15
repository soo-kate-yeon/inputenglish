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
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import type {
  AppHighlight,
  CuratedVideo,
  PracticeCoachingSummary,
  PracticeMode,
  PracticePrompt,
  SavedSentence,
  Sentence,
} from "@inputenglish/shared";
import { groupSentencesByMode } from "@inputenglish/shared";
import {
  deletePlaybookEntry,
  ensurePracticePrompts,
  fetchCuratedVideo,
  fetchLearningSessionDetail,
  fetchPlaybookEntries,
  savePlaybookEntry,
  savePracticeAttempt,
  type SessionListItem,
} from "../../src/lib/api";
import { appStore, studyStore } from "../../src/lib/stores";
import YouTubePlayer, {
  YouTubePlayerHandle,
} from "../../src/components/player/YouTubePlayer";
import ScriptLine from "../../src/components/listening/ScriptLine";
import RecordingBar from "../../src/components/shadowing/RecordingBar";
import ShadowingRecordButton from "../../src/components/shadowing/ShadowingRecordButton";
import ContextBriefCard from "../../src/components/study/ContextBriefCard";
import HighlightBottomSheet from "../../src/components/study/HighlightBottomSheet";
import { TransformationCarousel } from "../../src/components/study/TransformationCarousel";
import useAudioRecorder from "../../src/hooks/useAudioRecorder";
import { getPronunciationScore, uploadRecording } from "../../src/lib/ai-api";
import { trackEvent } from "../../src/lib/analytics";
import {
  buildPracticeDraft,
  generateRewriteCoaching,
  generateVoiceCoachingSummary,
} from "../../src/lib/professional-practice";
import { useAuth } from "../../src/contexts/AuthContext";
import { recordSessionVisit } from "../../src/lib/recent-sessions";
import { useSubscription } from "../../src/hooks/useSubscription";
import { colors, radius, font } from "../../src/theme";

type MainTab = "listening" | "shadowing" | "transformation";
type ShadowingMode = "sentence" | "paragraph" | "total";
const SHADOWING_MODES: Array<{ key: ShadowingMode; label: string }> = [
  { key: "sentence", label: "문장 보기" },
  { key: "paragraph", label: "문단 보기" },
  { key: "total", label: "전체 보기" },
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
  const [playerReady, setPlayerReady] = useState(false);
  const [scriptVisible, setScriptVisible] = useState(false);
  const [translationVisible, setTranslationVisible] = useState(false);
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

  // Transformation bookmark state
  // Maps sentence text → playbook entry ID for toggle/delete
  const [bookmarkedEntryMap, setBookmarkedEntryMap] = useState<
    Map<string, string>
  >(new Map());
  const bookmarkedEntryMapRef = useRef(bookmarkedEntryMap);
  bookmarkedEntryMapRef.current = bookmarkedEntryMap;

  // Highlight state
  const [highlightSentence, setHighlightSentence] = useState<Sentence | null>(
    null,
  );
  const [highlightSaving, setHighlightSaving] = useState(false);

  const playerRef = useRef<YouTubePlayerHandle>(null);
  const listRef = useRef<FlatList<Sentence>>(null);
  const activeIdRef = useRef<string | null>(null);
  const loopIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekLockRef = useRef(false);
  const isPollingRef = useRef(false);
  const hasAutoStartedListeningRef = useRef(false);
  const shadowingRestartTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

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
    hasAutoStartedListeningRef.current = false;
    setPlayerReady(false);
    setScriptVisible(false);
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
        if (sessionId) recordSessionVisit(sessionId, videoId);
      })
      .catch((e: Error) => setError(e.message ?? "Failed to load video"))
      .finally(() => setLoading(false));
  }, [videoId, sessionId]);

  // Load existing bookmark playbook entries for this session
  useEffect(() => {
    if (!user?.id || !sessionId) return;
    fetchPlaybookEntries(user.id)
      .then((entries) => {
        const map = new Map<string, string>();
        for (const e of entries) {
          if (e.session_id === sessionId && e.practice_mode === "bookmark") {
            map.set(e.source_sentence, e.id);
          }
        }
        setBookmarkedEntryMap(map);
      })
      .catch(() => {});
  }, [user?.id, sessionId]);

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

  const handleStateChange = useCallback(
    (state: string) => {
      if (state === "playing") {
        setPlaying(true);
        return;
      }

      if (state === "ended" && mainTab === "shadowing" && activeIdRef.current) {
        const loopingSegment =
          shadowingSentences.find((item) => item.id === activeIdRef.current) ??
          studySentences.find((item) => item.id === activeIdRef.current);
        if (loopingSegment) {
          playerRef.current?.seekTo(
            loopingSegment.startTime + playerBaseOffset,
          );
          setPlaying(true);
          return;
        }
      }

      if (state === "paused" || state === "ended") {
        setPlaying(false);
      }
    },
    [mainTab, playerBaseOffset, shadowingSentences, studySentences],
  );

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
      if (seekLockRef.current || isPollingRef.current) return;
      isPollingRef.current = true;
      try {
        const t = await playerRef.current?.getCurrentTime();
        if (t === undefined) return;
        const rel = Math.max(0, t - offset);

        // Loop (listening + transformation)
        if (mainTab === "listening" || mainTab === "transformation") {
          const lid = loopIdRef.current;
          if (lid) {
            const ls = allSentences.find((s) => s.id === lid);
            if (ls && rel >= ls.endTime - 0.08) {
              seekLockRef.current = true;
              activeIdRef.current = ls.id;
              setActiveSentenceId(ls.id);
              playerRef.current?.seekTo(ls.startTime + offset);
              setTimeout(() => {
                seekLockRef.current = false;
              }, 300);
              return;
            }
          }
        }

        if (mainTab === "shadowing" && activeIdRef.current) {
          const loopingSegment =
            shadowingSentences.find(
              (item) => item.id === activeIdRef.current,
            ) ?? studySentences.find((item) => item.id === activeIdRef.current);
          if (
            loopingSegment &&
            rel >= Math.max(loopingSegment.endTime - 0.05, 0)
          ) {
            seekLockRef.current = true;
            playerRef.current?.seekTo(loopingSegment.startTime + offset);
            setPlaying(true);
            setTimeout(() => {
              seekLockRef.current = false;
            }, 300);
            return;
          }
        }

        if (sessionEndTime > 0 && rel >= sessionEndTime) {
          seekLockRef.current = true;
          setPlaying(false);
          playerRef.current?.seekTo(playerStartSeconds);
          setTimeout(() => {
            seekLockRef.current = false;
          }, 300);
          return;
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
      } finally {
        isPollingRef.current = false;
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
    sessionStartTime,
    sessionEndTime,
    shadowingMode,
    shadowingSentences,
    studySentences,
    video,
  ]);

  // ── Listening handlers ──

  const handleSentenceTap = useCallback(
    (sentence: Sentence) => {
      if (seekDebounce.current) clearTimeout(seekDebounce.current);
      // Immediate visual feedback + lock to prevent polling interference
      seekLockRef.current = true;
      activeIdRef.current = sentence.id;
      setActiveSentenceId(sentence.id);

      seekDebounce.current = setTimeout(() => {
        const offset = playerBaseOffset;
        playerRef.current?.seekTo(sentence.startTime + offset);
        // Hold lock for 500ms after seek for bridge settle time
        setTimeout(() => {
          seekLockRef.current = false;
        }, 500);
      }, 300);
    },
    [playerBaseOffset],
  );

  const playSentenceImmediately = useCallback(
    (sentence: Sentence) => {
      if (seekDebounce.current) clearTimeout(seekDebounce.current);
      seekLockRef.current = true;
      activeIdRef.current = sentence.id;
      setActiveSentenceId(sentence.id);
      playerRef.current?.seekTo(sentence.startTime + playerBaseOffset);
      setPlaying(true);
      setTimeout(() => {
        seekLockRef.current = false;
      }, 500);
    },
    [playerBaseOffset],
  );

  useEffect(() => {
    if (briefExpanded || mainTab !== "listening" || !playerReady) return;
    if (hasAutoStartedListeningRef.current) return;
    const firstSentence = studySentences[0];
    if (!firstSentence) return;

    hasAutoStartedListeningRef.current = true;
    playSentenceImmediately(firstSentence);
  }, [
    briefExpanded,
    mainTab,
    playerReady,
    playSentenceImmediately,
    studySentences,
  ]);

  const handleLoopToggle = useCallback((sentence: Sentence) => {
    if (sentence.endTime - sentence.startTime < 0.5) return;
    setLoopingSentenceId((prev) => {
      const next = prev === sentence.id ? null : sentence.id;
      loopIdRef.current = next;
      return next;
    });
  }, []);

  const stopVideoPlayback = useCallback(() => {
    if (seekDebounce.current) {
      clearTimeout(seekDebounce.current);
      seekDebounce.current = null;
    }
    seekLockRef.current = false;
    loopIdRef.current = null;
    setLoopingSentenceId(null);
    setPlaying(false);
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

  const handleBookmarkToggle = useCallback(
    (sentence: Sentence) => {
      if (!user?.id || !sessionId || !videoId) return;
      const existingEntryId = bookmarkedEntryMapRef.current.get(sentence.text);
      if (existingEntryId) {
        // Remove bookmark
        setBookmarkedEntryMap((prev) => {
          const next = new Map(prev);
          next.delete(sentence.text);
          return next;
        });
        deletePlaybookEntry(user.id, existingEntryId).catch(() => {});
      } else {
        // Optimistic update: show bookmark immediately
        const tempId = `temp-${Date.now()}`;
        setBookmarkedEntryMap((prev) =>
          new Map(prev).set(sentence.text, tempId),
        );
        // Persist to server
        savePlaybookEntry(user.id, {
          sessionId,
          sourceVideoId: videoId,
          sourceSentence: sentence.text,
          practiceMode: "bookmark",
          userRewrite: "",
        })
          .then((entry) => {
            setBookmarkedEntryMap((prev) =>
              new Map(prev).set(sentence.text, entry.id),
            );
          })
          .catch(() => {
            // Rollback on failure
            setBookmarkedEntryMap((prev) => {
              const next = new Map(prev);
              next.delete(sentence.text);
              return next;
            });
          });
      }
    },
    [user?.id, sessionId, videoId, sessionDetail],
  );

  // ── Highlight handlers ──

  const addHighlight = appStore((state) => state.addHighlight);

  const handleLongPress = useCallback((sentence: Sentence) => {
    setHighlightSentence(sentence);
  }, []);

  const handleHighlightSave = useCallback(
    async (userNote: string, selectedText?: string) => {
      if (!highlightSentence || !videoId) return;
      setHighlightSaving(true);
      try {
        await addHighlight({
          id: Crypto.randomUUID(),
          videoId,
          sentenceId: highlightSentence.id,
          originalText: selectedText || highlightSentence.text,
          userNote: userNote || undefined,
          createdAt: Date.now(),
        } as AppHighlight);
      } finally {
        setHighlightSaving(false);
        setHighlightSentence(null);
      }
    },
    [highlightSentence, videoId, addHighlight],
  );

  // ── Shadowing handlers ──

  const restartShadowingPlayback = useCallback(
    (mode: ShadowingMode) => {
      if (shadowingRestartTimeoutRef.current) {
        clearTimeout(shadowingRestartTimeoutRef.current);
        shadowingRestartTimeoutRef.current = null;
      }

      const groupedSentences = groupSentencesByMode(studySentences, mode);
      setShadowingMode(mode);
      setShadowingSentences(groupedSentences);
      loopIdRef.current = null;
      setLoopingSentenceId(null);

      const firstSegment = groupedSentences[0];
      if (!firstSegment) {
        setActiveSentenceId(null);
        activeIdRef.current = null;
        return;
      }

      seekLockRef.current = true;
      setPlaying(false);
      activeIdRef.current = firstSegment.id;
      setActiveSentenceId(firstSegment.id);
      playerRef.current?.seekTo(firstSegment.startTime + playerBaseOffset);
      shadowingRestartTimeoutRef.current = setTimeout(() => {
        setPlaying(true);
        shadowingRestartTimeoutRef.current = null;
      }, 120);
      setTimeout(() => {
        seekLockRef.current = false;
      }, 500);
    },
    [playerBaseOffset, studySentences],
  );

  const handleShadowingModeChange = useCallback(
    (m: ShadowingMode) => {
      restartShadowingPlayback(m);
    },
    [restartShadowingPlayback],
  );

  useEffect(() => {
    if (mainTab !== "shadowing") return;
    if (!activeSentenceId) return;
    activeIdRef.current = activeSentenceId;
  }, [activeSentenceId, mainTab]);

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
      setPlaying(true);
    },
    [playerBaseOffset, shadowingSentences, studySentences],
  );

  const handleRecord = useCallback(
    async (sentenceId: string) => {
      if (isRecorderBusy || recordingState === "recording") return;
      setPlaying(false);
      await new Promise((resolve) => setTimeout(resolve, 120));
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

    stopVideoPlayback();
    setMainTab("transformation");
  }, [plan, stopVideoPlayback]);

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
      });

    try {
      await savePlaybookEntry(user.id, {
        sessionId: sessionDetail.id,
        sourceVideoId: sessionDetail.source_video_id,
        sourceSentence: sourceSentence.text,
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

  const listeningData = studySentences;
  const isRecording = recordingState !== "idle";
  const currentShadowingIndex = Math.max(
    shadowingSentences.findIndex((item) => item.id === activeSentenceId),
    0,
  );
  const currentShadowingSentence =
    shadowingSentences[currentShadowingIndex] ?? null;
  const hasPrevShadowing = currentShadowingIndex > 0;
  const hasNextShadowing =
    currentShadowingIndex < shadowingSentences.length - 1;

  const moveShadowingFocus = useCallback(
    (direction: "prev" | "next") => {
      if (!shadowingSentences.length) return;
      const nextIndex =
        direction === "prev"
          ? Math.max(currentShadowingIndex - 1, 0)
          : Math.min(currentShadowingIndex + 1, shadowingSentences.length - 1);
      const nextSentence = shadowingSentences[nextIndex];
      if (!nextSentence) return;
      handleSeek(nextSentence.id);
    },
    [currentShadowingIndex, handleSeek, shadowingSentences],
  );

  // ── Render ──

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
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />

        {/* Main tabs: top of sheet */}
        {!briefExpanded ? (
          <View style={styles.mainTabs}>
            <TouchableOpacity
              style={[
                styles.mainTab,
                mainTab === "listening" && styles.mainTabActive,
              ]}
              onPress={() => {
                setMainTab("listening");
                loopIdRef.current = null;
                setLoopingSentenceId(null);
              }}
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
              onPress={() => {
                setMainTab("shadowing");
                setScriptVisible(true);
                restartShadowingPlayback(shadowingMode);
              }}
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
        ) : null}

        {/* Video player */}
        {mainTab !== "transformation" ? (
          <YouTubePlayer
            ref={playerRef}
            videoId={video.video_id}
            playing={playing}
            onReady={() => setPlayerReady(true)}
            onChangeState={handleStateChange}
            startSeconds={playerStartSeconds}
          />
        ) : null}

        {briefExpanded ? (
          <>
            <ScrollView
              style={styles.briefScroll}
              contentContainerStyle={styles.briefScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Session info header */}
              {sessionDetail && (
                <View style={styles.briefHeader}>
                  <Text style={styles.briefSessionTitle} numberOfLines={3}>
                    {sessionDetail.title}
                  </Text>
                  {sessionDetail.channel_name ? (
                    <Text style={styles.briefChannelName}>
                      {sessionDetail.channel_name}
                    </Text>
                  ) : null}
                </View>
              )}

              <ContextBriefCard context={sessionDetail?.context ?? null} />
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
                    });
                    setHasStarted(true);
                  }
                  setBriefExpanded(false);
                }}
                activeOpacity={0.85}
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
            <View style={styles.scriptContainer}>
              {mainTab === "transformation" ? (
                sessionId ? (
                  <TransformationCarousel
                    sessionId={sessionId}
                    sentences={studySentences}
                    tipText={
                      sessionDetail?.context?.grammar_rhetoric_note ?? null
                    }
                    onStartExercise={stopVideoPlayback}
                    savedSentenceIds={
                      new Set(
                        Array.from(bookmarkedEntryMap.keys()).flatMap((text) =>
                          studySentences
                            .filter((s) => s.text === text)
                            .map((s) => s.id),
                        ),
                      )
                    }
                    onSaveSentence={handleBookmarkToggle}
                  />
                ) : null
              ) : !scriptVisible ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>
                    스크립트가 숨겨져 있어요
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    처음에는 스크립트 없이 끝까지 들어보세요. 너무 어렵거나
                    하나도 들리지 않는다면 난이도가 더 쉬운 영상으로 먼저
                    공부하세요.
                  </Text>
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
                          (s) =>
                            s.sentenceId === item.id && s.videoId === videoId,
                        )}
                        scriptHidden={false}
                        showTranslation={translationVisible}
                        onTap={handleSentenceTap}
                        onLongPress={handleLongPress}
                        onLoopToggle={handleLoopToggle}
                        onSaveToggle={handleSaveToggle}
                      />
                    )}
                    onScrollToIndexFailed={() => {}}
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                  />
                )
              ) : /* ── Shadowing focus ── */
              shadowingSentences.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>NO TRANSCRIPT</Text>
                </View>
              ) : (
                <View style={styles.shadowingFocus}>
                  <View style={styles.shadowingMetaRow}>
                    <Text style={styles.shadowingMetaLabel}>
                      {shadowingMode === "sentence"
                        ? "문장 집중"
                        : shadowingMode === "paragraph"
                          ? "문단 집중"
                          : "전체 따라 말하기"}
                    </Text>
                    <Text style={styles.shadowingMetaCount}>
                      {currentShadowingIndex + 1} / {shadowingSentences.length}
                    </Text>
                  </View>

                  {currentShadowingSentence ? (
                    <Pressable
                      style={styles.shadowingTextBlock}
                      onPress={() => handleSeek(currentShadowingSentence.id)}
                    >
                      <Text style={styles.shadowingPrimaryText}>
                        {currentShadowingSentence.text}
                      </Text>
                      {translationVisible &&
                      currentShadowingSentence.translation ? (
                        <Text style={styles.shadowingTranslationText}>
                          {currentShadowingSentence.translation}
                        </Text>
                      ) : null}
                    </Pressable>
                  ) : (
                    <View style={styles.empty}>
                      <Text style={styles.emptyText}>NO TRANSCRIPT</Text>
                    </View>
                  )}
                </View>
              )}

              {mainTab === "listening" && (
                <LinearGradient
                  colors={["rgba(255,255,255,0)", colors.bg]}
                  style={styles.scriptGradient}
                  pointerEvents="none"
                />
              )}
            </View>

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
            {!isRecording && mainTab === "shadowing" ? (
              <View style={styles.shadowingBottomBar}>
                <View style={styles.shadowingNavRow}>
                  <TouchableOpacity
                    style={[
                      styles.shadowingNavBtn,
                      !hasPrevShadowing && styles.shadowingNavBtnDisabled,
                    ]}
                    onPress={() => moveShadowingFocus("prev")}
                    activeOpacity={0.7}
                    disabled={!hasPrevShadowing}
                  >
                    <Text
                      style={[
                        styles.shadowingNavBtnText,
                        !hasPrevShadowing && styles.shadowingNavBtnTextDisabled,
                      ]}
                    >
                      이전
                    </Text>
                  </TouchableOpacity>

                  <ShadowingRecordButton
                    style={styles.shadowingRecordButtonWrap}
                    disabled={!currentShadowingSentence}
                    onPress={() =>
                      currentShadowingSentence
                        ? handleRecord(currentShadowingSentence.id)
                        : undefined
                    }
                  />

                  <TouchableOpacity
                    style={[
                      styles.shadowingNavBtn,
                      !hasNextShadowing && styles.shadowingNavBtnDisabled,
                    ]}
                    onPress={() => moveShadowingFocus("next")}
                    activeOpacity={0.7}
                    disabled={!hasNextShadowing}
                  >
                    <Text
                      style={[
                        styles.shadowingNavBtnText,
                        !hasNextShadowing && styles.shadowingNavBtnTextDisabled,
                      ]}
                    >
                      다음
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.shadowingToolsRow}>
                  <TouchableOpacity
                    style={styles.shadowingToolBtn}
                    onPress={() => setScriptVisible((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.shadowingToolText}>
                      {scriptVisible ? "스크립트 숨기기" : "스크립트 보기"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.shadowingToolBtn}
                    onPress={() => setTranslationVisible((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.shadowingToolText}>
                      {translationVisible ? "해석 숨기기" : "해석 보기"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : !isRecording && mainTab !== "transformation" ? (
              <View style={styles.bottomBar}>
                <View style={styles.bottomMeta}>
                  <View style={styles.bottomLeft}>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => setBriefExpanded(true)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name="reader-outline"
                        size={20}
                        color={colors.text}
                      />
                    </TouchableOpacity>
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
                        color={colors.text}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => setTranslationVisible((v) => !v)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={translationVisible ? "globe" : "globe-outline"}
                        size={20}
                        color={
                          translationVisible ? colors.text : colors.textMuted
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.endBtn}
                  onPress={() => router.back()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.endBtnText}>학습 끝내기</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}
      </SafeAreaView>

      <HighlightBottomSheet
        visible={highlightSentence !== null}
        sentence={highlightSentence}
        saving={highlightSaving}
        onSave={handleHighlightSave}
        onClose={() => setHighlightSentence(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  safeArea: { flex: 1 },
  state: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: { fontSize: 13, letterSpacing: 1, color: colors.textMuted },

  // Brief scroll + fixed CTA
  briefScroll: { flex: 1 },
  briefScrollContent: { paddingBottom: 24 },

  briefHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  briefSessionTitle: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.text,
    lineHeight: 30,
    letterSpacing: -0.2,
  },
  briefChannelName: {
    fontSize: font.size.md,
    color: colors.textSecondary,
    fontWeight: font.weight.medium,
  },
  briefBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.bgMuted,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 2,
  },
  briefBadgeText: {
    fontSize: 11,
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },

  briefCta: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  briefCtaButton: {
    backgroundColor: colors.bgInverse,
    paddingVertical: 16,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  briefCtaText: {
    fontSize: 15,
    fontWeight: font.weight.semibold,
    color: colors.textInverse,
    letterSpacing: 0.3,
  },

  // Main tabs — segmented control (podcast-native)
  mainTabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.lg,
    padding: 3,
  },
  mainTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: radius.md,
  },
  mainTabActive: {
    backgroundColor: colors.bg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  mainTabText: {
    fontSize: 13,
    letterSpacing: 0.2,
    fontWeight: font.weight.medium,
    color: colors.textMuted,
  },
  mainTabTextActive: { color: colors.text, fontWeight: font.weight.semibold },

  // Sub tabs (shadowing modes)
  subTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  subTabActive: { borderBottomColor: colors.text },
  subTabText: {
    fontSize: 14,
    letterSpacing: 0.2,
    fontWeight: font.weight.medium,
    color: colors.textMuted,
  },
  subTabTextActive: { color: colors.text, fontWeight: font.weight.semibold },

  // Script
  scriptContainer: { flex: 1 },
  scriptGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
  },
  list: { flex: 1 },
  listContent: { paddingTop: 8, paddingBottom: 16 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: -0.2,
    color: colors.text,
    fontWeight: font.weight.semibold,
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    letterSpacing: 2,
    color: colors.textMuted,
    fontWeight: font.weight.semibold,
  },
  shadowingFocus: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
  },
  shadowingMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  shadowingMetaLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textMuted,
    fontWeight: font.weight.semibold,
  },
  shadowingMetaCount: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: font.weight.medium,
  },
  shadowingTextBlock: {
    flex: 1,
    justifyContent: "center",
  },
  shadowingPrimaryText: {
    fontSize: font.size.lg,
    lineHeight: 30,
    color: colors.text,
    fontWeight: font.weight.bold,
    letterSpacing: 0,
  },
  shadowingTranslationText: {
    marginTop: 20,
    fontSize: font.size.sm,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    backgroundColor: colors.bg,
  },
  bottomMeta: {
    flex: 1,
    gap: 0,
  },
  bottomLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  endBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  endBtnText: {
    fontSize: 12,
    letterSpacing: 0.5,
    fontWeight: font.weight.semibold,
    color: colors.text,
  },
  shadowingBottomBar: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    gap: 12,
  },
  shadowingNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  shadowingNavBtn: {
    minWidth: 72,
    paddingHorizontal: 14,
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  shadowingNavBtnDisabled: {
    borderColor: colors.border,
  },
  shadowingNavBtnText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  shadowingNavBtnTextDisabled: {
    color: colors.textMuted,
  },
  shadowingRecordButtonWrap: {
    flex: 1,
  },
  shadowingToolsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  shadowingToolBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  shadowingToolText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: font.weight.semibold,
  },
});
