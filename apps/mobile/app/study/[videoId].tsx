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
  useWindowDimensions,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import SentenceNavigationBar from "../../src/components/common/SentenceNavigationBar";
import ScriptLine from "../../src/components/listening/ScriptLine";
import RecordingBar from "../../src/components/shadowing/RecordingBar";
import StudyBriefSheet from "../../src/components/study/StudyBriefSheet";
import HighlightBottomSheet from "../../src/components/study/HighlightBottomSheet";
import { TransformationCarousel } from "../../src/components/study/TransformationCarousel";
import useAudioRecorder from "../../src/hooks/useAudioRecorder";
import {
  getReadableAiApiErrorMessage,
  getReadablePronunciationJobError,
  requestPronunciationAnalysis,
  uploadRecording,
  waitForPronunciationAnalysisCompletion,
} from "../../src/lib/ai-api";
import { trackEvent } from "../../src/lib/analytics";
import { captureException as captureSentryException } from "../../src/lib/sentry";
import {
  readPronunciationAnalysisCache,
  writePronunciationAnalysisCache,
} from "../../src/lib/pronunciation-analysis-cache";
import {
  buildPracticeDraft,
  generatePronunciationCoachingSummary,
  generateRewriteCoaching,
} from "../../src/lib/professional-practice";
import { useAuth } from "../../src/contexts/AuthContext";
import { recordSessionVisit } from "../../src/lib/recent-sessions";
import { useSubscription } from "../../src/hooks/useSubscription";
import { resolveSentencesByIdsOrRange } from "../../src/lib/transcript-navigation";
import {
  colors,
  font,
  leading,
  radius,
  shadow,
  spacing,
} from "../../src/theme";

type MainTab = "listening" | "shadowing" | "transformation";
type ShadowingMode = "sentence" | "paragraph" | "total";
const LISTENING_SCROLL_VIEW_OFFSET = 68;

function resolveStudySentences(
  video: CuratedVideo | null,
  sessionDetail: SessionListItem | null,
): Sentence[] {
  return resolveSentencesByIdsOrRange(
    video?.transcript ?? [],
    sessionDetail?.sentence_ids,
    sessionDetail?.start_time,
    sessionDetail?.end_time,
    Number.POSITIVE_INFINITY,
  );
}

export default function StudyScreen() {
  const {
    videoId,
    sessionId,
    sentenceId: entrySentenceId,
    initialTab,
    autoStartRecording,
  } = useLocalSearchParams<{
    videoId: string;
    sessionId?: string;
    sentenceId?: string;
    initialTab?: MainTab;
    autoStartRecording?: "0" | "1";
  }>();

  const [video, setVideo] = useState<CuratedVideo | null>(null);
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
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
  const [briefExpanded, setBriefExpanded] = useState(false);
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
  const shadowingLoopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const entryRoutingAppliedRef = useRef(false);

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
    entryRoutingAppliedRef.current = false;
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
    setBriefExpanded(false);
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

  useEffect(() => {
    if (!sessionDetail || studySentences.length === 0 || !user?.id) {
      return;
    }

    const sourceSentence =
      studySentences.find(
        (sentence) => sentence.id === selectedPracticeSentenceId,
      ) ?? studySentences[0];
    const cacheParams = {
      userId: user.id,
      source: "study" as const,
      sessionId: sessionDetail.id,
      sentenceId: sourceSentence.id,
    };
    const cachedJob = readPronunciationAnalysisCache(cacheParams);

    if (!cachedJob) {
      return;
    }

    let cancelled = false;

    if (cachedJob.status === "complete" && cachedJob.result) {
      setCoachingSummary(
        generatePronunciationCoachingSummary(cachedJob.result),
      );
      return;
    }

    if (cachedJob.status === "failed") {
      return;
    }

    setVoiceCoachingLoading(true);

    void waitForPronunciationAnalysisCompletion(cachedJob.analysis_id, {
      maxAttempts: 4,
    })
      .then((completedJob) => {
        if (cancelled) return;

        writePronunciationAnalysisCache(cacheParams, completedJob);

        if (completedJob.status === "complete" && completedJob.result) {
          setCoachingSummary(
            generatePronunciationCoachingSummary(completedJob.result),
          );
        }
      })
      .catch((restoreError) => {
        if (cancelled) return;
        console.error(
          "[StudyScreen] Failed to restore pronunciation analysis:",
          restoreError,
        );
      })
      .finally(() => {
        if (!cancelled) {
          setVoiceCoachingLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPracticeSentenceId, sessionDetail, studySentences, user?.id]);

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

      if (
        state === "ended" &&
        mainTab === "shadowing" &&
        shadowingMode !== "total" &&
        activeIdRef.current
      ) {
        const loopingSegment =
          shadowingSentences.find((item) => item.id === activeIdRef.current) ??
          studySentences.find((item) => item.id === activeIdRef.current);
        if (loopingSegment) {
          if (shadowingLoopTimeoutRef.current) {
            clearTimeout(shadowingLoopTimeoutRef.current);
          }
          seekLockRef.current = true;
          setPlaying(false);
          playerRef.current?.seekTo(
            loopingSegment.startTime + playerBaseOffset,
          );
          shadowingLoopTimeoutRef.current = setTimeout(() => {
            setPlaying(true);
            shadowingLoopTimeoutRef.current = null;
          }, 120);
          setTimeout(() => {
            seekLockRef.current = false;
          }, 320);
          return;
        }
      }

      if (state === "paused" || state === "ended") {
        setPlaying(false);
      }
    },
    [
      mainTab,
      playerBaseOffset,
      shadowingMode,
      shadowingSentences,
      studySentences,
    ],
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

        if (
          mainTab === "shadowing" &&
          shadowingMode !== "total" &&
          activeIdRef.current
        ) {
          const loopingSegment =
            shadowingSentences.find(
              (item) => item.id === activeIdRef.current,
            ) ?? studySentences.find((item) => item.id === activeIdRef.current);
          if (
            loopingSegment &&
            rel >= Math.max(loopingSegment.endTime - 0.18, 0)
          ) {
            if (shadowingLoopTimeoutRef.current) {
              clearTimeout(shadowingLoopTimeoutRef.current);
            }
            seekLockRef.current = true;
            setPlaying(false);
            playerRef.current?.seekTo(loopingSegment.startTime + offset);
            shadowingLoopTimeoutRef.current = setTimeout(() => {
              setPlaying(true);
              shadowingLoopTimeoutRef.current = null;
            }, 120);
            setTimeout(() => {
              seekLockRef.current = false;
            }, 320);
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

        if (mainTab === "shadowing") {
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
    if (shadowingLoopTimeoutRef.current) {
      clearTimeout(shadowingLoopTimeoutRef.current);
      shadowingLoopTimeoutRef.current = null;
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
      if (shadowingLoopTimeoutRef.current) {
        clearTimeout(shadowingLoopTimeoutRef.current);
        shadowingLoopTimeoutRef.current = null;
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
      if (shadowingLoopTimeoutRef.current) {
        clearTimeout(shadowingLoopTimeoutRef.current);
        shadowingLoopTimeoutRef.current = null;
      }
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

  useEffect(() => {
    if (!playerReady || studySentences.length === 0) return;
    if (entryRoutingAppliedRef.current) return;
    if (!entrySentenceId && !initialTab) return;

    const targetSentence =
      studySentences.find((sentence) => sentence.id === entrySentenceId) ??
      studySentences[0];

    if (!targetSentence) return;

    entryRoutingAppliedRef.current = true;
    setBriefExpanded(false);
    setScriptVisible(true);

    if (initialTab === "shadowing") {
      setMainTab("shadowing");
      setActiveSentenceId(targetSentence.id);
      activeIdRef.current = targetSentence.id;
      handleSeek(targetSentence.id);

      if (autoStartRecording === "1") {
        setTimeout(() => {
          void handleRecord(targetSentence.id);
        }, 220);
      }
      return;
    }

    if (initialTab === "transformation") {
      setMainTab("transformation");
      setSelectedPracticeSentenceId(targetSentence.id);
      return;
    }

    setMainTab("listening");
    playSentenceImmediately(targetSentence);
  }, [
    autoStartRecording,
    entrySentenceId,
    handleRecord,
    handleSeek,
    initialTab,
    playSentenceImmediately,
    playerReady,
    studySentences,
  ]);

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
      try {
        const publicUrl = await uploadRecording(
          uri,
          user.id,
          videoId,
          sid,
          recDuration,
        );
        setUploadedRecordingUrls((prev) => ({ ...prev, [sid]: publicUrl }));
      } catch (err) {
        // @MX:NOTE: Surface upload errors — previously silenced with
        //           .catch(() => {}), which hid the real failure in TestFlight.
        //           Also forwarded to Sentry so remote testers produce signal.
        console.error("[study.handleConfirm] uploadRecording failed", err);
        captureSentryException(err, {
          location: "study.handleConfirm.uploadRecording",
          videoId,
          sentenceId: sid,
          userId: user.id,
        });
        Alert.alert("녹음 업로드 실패", getReadableAiApiErrorMessage(err));
      }
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
    loopIdRef.current = null;
    setLoopingSentenceId(null);
    setMainTab("transformation");
  }, [plan]);

  const handleExpressionSentenceTap = useCallback(
    (sentence: Sentence) => {
      seekLockRef.current = true;
      loopIdRef.current = sentence.id;
      setLoopingSentenceId(sentence.id);
      playerRef.current?.seekTo(sentence.startTime + playerBaseOffset);
      setPlaying(true);
      setTimeout(() => {
        seekLockRef.current = false;
      }, 500);
    },
    [playerBaseOffset],
  );

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
      trackEvent("pronunciation_analysis_requested", {
        sessionId: sessionDetail.id,
        sentenceId: sourceSentence.id,
        entry: "study_transformation",
      });

      const requestedJob = await requestPronunciationAnalysis({
        recordingUrl,
        referenceText: sourceSentence.text,
        sentenceId: sourceSentence.id,
        videoId: sessionDetail.source_video_id,
        sessionId: sessionDetail.id,
        source: "study",
      });
      if (user?.id) {
        writePronunciationAnalysisCache(
          {
            userId: user.id,
            source: "study",
            sessionId: sessionDetail.id,
            sentenceId: sourceSentence.id,
          },
          requestedJob,
        );
      }
      const completedJob =
        requestedJob.status === "complete" || requestedJob.status === "failed"
          ? requestedJob
          : await waitForPronunciationAnalysisCompletion(
              requestedJob.analysis_id,
            );
      if (user?.id) {
        writePronunciationAnalysisCache(
          {
            userId: user.id,
            source: "study",
            sessionId: sessionDetail.id,
            sentenceId: sourceSentence.id,
          },
          completedJob,
        );
      }

      if (completedJob.status !== "complete" || !completedJob.result) {
        trackEvent("pronunciation_analysis_failed", {
          sessionId: sessionDetail.id,
          sentenceId: sourceSentence.id,
          entry: "study_transformation",
          code: completedJob.error?.code ?? "ANALYSIS_INCOMPLETE",
        });
        Alert.alert(
          "발음 분석을 완료하지 못했어요",
          getReadablePronunciationJobError(completedJob.error),
        );
        return;
      }

      trackEvent("pronunciation_analysis_complete", {
        sessionId: sessionDetail.id,
        sentenceId: sourceSentence.id,
        entry: "study_transformation",
        analysisId: completedJob.analysis_id,
        overallScore: completedJob.result.overall_score ?? null,
      });

      const summary = generatePronunciationCoachingSummary(completedJob.result);
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
      trackEvent("pronunciation_analysis_failed", {
        sessionId: sessionDetail.id,
        sentenceId: sourceSentence.id,
        entry: "study_transformation",
        code: "REQUEST_FAILED",
      });
      Alert.alert(
        "발음 분석을 완료하지 못했어요",
        getReadableAiApiErrorMessage(voiceError),
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
  const currentListeningIndex = Math.max(
    listeningData.findIndex((item) => item.id === activeSentenceId),
    0,
  );
  const hasPrevListening = currentListeningIndex > 0;
  const hasNextListening = currentListeningIndex < listeningData.length - 1;
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

  const moveListeningFocus = useCallback(
    (direction: "prev" | "next") => {
      if (!listeningData.length) return;
      const nextIndex =
        direction === "prev"
          ? Math.max(currentListeningIndex - 1, 0)
          : Math.min(currentListeningIndex + 1, listeningData.length - 1);
      const nextSentence = listeningData[nextIndex];
      if (!nextSentence) return;
      handleSentenceTap(nextSentence);
    },
    [currentListeningIndex, handleSentenceTap, listeningData],
  );

  useEffect(() => {
    if (briefExpanded || mainTab !== "listening" || !scriptVisible) return;
    if (!activeSentenceId) return;

    const activeIndex = listeningData.findIndex(
      (sentence) => sentence.id === activeSentenceId,
    );

    if (activeIndex < 0) return;

    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: activeIndex,
        animated: true,
        viewOffset: LISTENING_SCROLL_VIEW_OFFSET,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [activeSentenceId, briefExpanded, listeningData, mainTab, scriptVisible]);

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          style={[styles.topActionButton, { top: insets.top + 10 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="탐색으로 닫기"
          style={[styles.closeStudyButton, { top: insets.top + 10 }]}
          onPress={() => router.replace("/(tabs)/explore" as never)}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </Pressable>

        {/* Video player — always visible */}
        <YouTubePlayer
          ref={playerRef}
          videoId={video.video_id}
          playing={playing}
          onReady={() => setPlayerReady(true)}
          onChangeState={handleStateChange}
          startSeconds={playerStartSeconds}
        />
        <View style={styles.mainTabs}>
          <Pressable
            style={({ pressed }) => [
              styles.mainTab,
              mainTab === "listening" && styles.mainTabActive,
              pressed && { opacity: 0.7 },
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
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.mainTab,
              mainTab === "shadowing" && styles.mainTabActive,
              pressed && { opacity: 0.7 },
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
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.mainTab,
              mainTab === "transformation" && styles.mainTabActive,
              pressed && { opacity: 0.7 },
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
          </Pressable>
        </View>

        {/* Shadowing pagination nav */}
        {mainTab === "shadowing" && shadowingSentences.length > 0 && (
          <View style={styles.shadowingPageNav}>
            <Pressable
              style={({ pressed }) => [
                styles.shadowingPageNavBtn,
                !hasPrevShadowing && styles.shadowingPageNavBtnDisabled,
                pressed && hasPrevShadowing && { opacity: 0.7 },
              ]}
              onPress={() => moveShadowingFocus("prev")}
              disabled={!hasPrevShadowing}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={hasPrevShadowing ? colors.text : colors.textMuted}
              />
            </Pressable>

            <Text style={styles.shadowingPageCount}>
              {currentShadowingIndex + 1} / {shadowingSentences.length}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.shadowingPageNavBtn,
                !hasNextShadowing && styles.shadowingPageNavBtnDisabled,
                pressed && hasNextShadowing && { opacity: 0.7 },
              ]}
              onPress={() => moveShadowingFocus("next")}
              disabled={!hasNextShadowing}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={hasNextShadowing ? colors.text : colors.textMuted}
              />
            </Pressable>
          </View>
        )}

        {mainTab === "listening" ? (
          <View style={styles.listeningSentenceNav}>
            <SentenceNavigationBar
              tone="light"
              hasPrev={hasPrevListening}
              hasNext={hasNextListening}
              onPrev={() => moveListeningFocus("prev")}
              onNext={() => moveListeningFocus("next")}
            />
          </View>
        ) : null}

        {/* Script area */}
        <View style={styles.scriptContainer}>
          {mainTab === "transformation" ? (
            sessionId ? (
              <TransformationCarousel
                sessionId={sessionId}
                sentences={studySentences}
                tipText={sessionDetail?.context?.grammar_rhetoric_note ?? null}
                onStartExercise={stopVideoPlayback}
                onSeekToSentence={handleExpressionSentenceTap}
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
              <Text style={styles.emptyTitle}>스크립트가 숨겨져 있어요</Text>
              {mainTab === "listening" ? (
                <>
                  <Text style={styles.emptySubtitle}>
                    처음에는 스크립트 없이 끝까지 들어보세요. 너무 어렵거나
                    하나도 들리지 않는다면 난이도가 더 쉬운 영상으로 먼저
                    공부하세요.
                  </Text>
                </>
              ) : null}
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
              {currentShadowingSentence ? (
                <ScrollView
                  style={styles.shadowingScroll}
                  contentContainerStyle={styles.shadowingScrollContent}
                  showsVerticalScrollIndicator={false}
                >
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
                </ScrollView>
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

        {/* Floating action column — brief / script / translation (listening + shadowing only) */}
        {!isRecording && mainTab !== "transformation" ? (
          <View
            style={[
              styles.studyActionColumn,
              { bottom: insets.bottom + spacing.lg },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="브리프 보기"
              style={styles.studyActionItem}
              onPress={() => setBriefExpanded(true)}
            >
              <View style={styles.studyIconBtn}>
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={colors.text}
                />
              </View>
              <Text style={styles.studyActionLabel}>브리프</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                scriptVisible ? "스크립트 숨기기" : "스크립트 보기"
              }
              style={styles.studyActionItem}
              onPress={() => setScriptVisible((v) => !v)}
            >
              <View
                style={[
                  styles.studyIconBtn,
                  scriptVisible && styles.studyIconBtnActive,
                ]}
              >
                <Ionicons
                  name={
                    scriptVisible
                      ? "chatbox-ellipses"
                      : "chatbox-ellipses-outline"
                  }
                  size={18}
                  color={scriptVisible ? colors.textInverse : colors.text}
                />
              </View>
              <Text
                style={[
                  styles.studyActionLabel,
                  scriptVisible && styles.studyActionLabelActive,
                ]}
              >
                스크립트
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                translationVisible ? "번역 숨기기" : "번역 보기"
              }
              style={styles.studyActionItem}
              onPress={() => setTranslationVisible((v) => !v)}
            >
              <View
                style={[
                  styles.studyIconBtn,
                  translationVisible && styles.studyIconBtnActive,
                ]}
              >
                <Ionicons
                  name={translationVisible ? "globe" : "globe-outline"}
                  size={18}
                  color={translationVisible ? colors.textInverse : colors.text}
                />
              </View>
              <Text
                style={[
                  styles.studyActionLabel,
                  translationVisible && styles.studyActionLabelActive,
                ]}
              >
                번역
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Recording FAB — right-aligned, shadowing only */}
        {mainTab === "shadowing" && !isRecording ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="녹음 시작"
            style={({ pressed }) => [
              styles.shadowingRecordFab,
              { bottom: insets.bottom + spacing.lg },
              pressed && { opacity: 0.85 },
              !currentShadowingSentence && { opacity: 0.38 },
            ]}
            onPress={() =>
              currentShadowingSentence
                ? handleRecord(currentShadowingSentence.id)
                : undefined
            }
            disabled={!currentShadowingSentence}
          >
            <Ionicons name="mic" size={22} color={colors.textInverse} />
          </Pressable>
        ) : null}
      </SafeAreaView>

      <StudyBriefSheet
        context={sessionDetail?.context ?? null}
        sessionTitle={sessionDetail?.title ?? null}
        channelName={sessionDetail?.channel_name ?? null}
        maxHeight={windowHeight - insets.top - windowWidth * (9 / 16)}
        bottomInset={insets.bottom}
        hasStarted={hasStarted}
        expanded={briefExpanded}
        onExpandedChange={setBriefExpanded}
        onStart={() => {
          if (!hasStarted && sessionDetail) {
            trackEvent("session_start", {
              sessionId: sessionDetail.id,
              sourceType: sessionDetail.source_type,
            });
            setHasStarted(true);
          }
        }}
      />

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
  topActionButton: {
    position: "absolute",
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  closeStudyButton: {
    position: "absolute",
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  state: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: {
    fontSize: font.size.sm,
    letterSpacing: font.tracking.wider,
    color: colors.textMuted,
  },

  // Brief scroll + fixed CTA
  // Main tabs — segmented control (podcast-native)
  mainTabs: {
    flexDirection: "row",
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.lg,
    padding: 3,
  },
  mainTab: {
    flex: 1,
    paddingVertical: spacing.sm + 1,
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
    fontSize: font.size.sm,
    letterSpacing: font.tracking.normal,
    fontWeight: font.weight.medium,
    color: colors.textMuted,
  },
  mainTabTextActive: { color: colors.text, fontWeight: font.weight.semibold },

  // Shadowing pagination nav (below main tabs)
  shadowingPageNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  shadowingPageNavBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  shadowingPageNavBtnDisabled: {
    opacity: 0.35,
  },
  shadowingPageCount: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
    fontWeight: font.weight.medium,
    letterSpacing: font.tracking.normal,
  },

  // Script
  scriptContainer: { flex: 1 },
  listeningSentenceNav: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
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
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: font.size.base,
    lineHeight: leading(font.size.base, font.lineHeight.relaxed),
    letterSpacing: font.tracking.semiTight,
    color: colors.text,
    fontWeight: font.weight.semibold,
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: spacing.sm + spacing.xs,
    fontSize: font.size.sm,
    lineHeight: leading(font.size.sm, font.lineHeight.relaxed),
    color: colors.textMuted,
    textAlign: "center",
  },
  emptyText: {
    fontSize: font.size.sm,
    letterSpacing: font.tracking.widest,
    color: colors.textMuted,
    fontWeight: font.weight.semibold,
  },
  shadowingFocus: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  shadowingScroll: {
    flex: 1,
  },
  shadowingScrollContent: {
    paddingBottom: 12,
  },
  shadowingTextBlock: {
    alignSelf: "stretch",
  },
  shadowingPrimaryText: {
    fontSize: font.size.lg,
    lineHeight: leading(font.size.lg, font.lineHeight.normal),
    color: colors.text,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.normal,
    textAlign: "left",
  },
  shadowingTranslationText: {
    marginTop: spacing.md + spacing.xs,
    fontSize: font.size.sm,
    lineHeight: leading(font.size.sm, font.lineHeight.relaxed),
    color: colors.textSecondary,
    textAlign: "left",
  },

  // Floating action row (left) + recording FAB (right)
  studyActionColumn: {
    position: "absolute",
    left: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
    zIndex: 20,
  },
  studyActionItem: {
    alignItems: "center",
    gap: spacing.xs,
  },
  studyIconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  studyIconBtnActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  studyActionLabel: {
    fontSize: font.size.xs,
    lineHeight: 16,
    color: colors.textMuted,
    fontWeight: font.weight.medium,
  },
  studyActionLabelActive: {
    color: colors.text,
  },
  // Recording FAB (shadowing)
  shadowingRecordFab: {
    position: "absolute",
    right: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    ...shadow.md,
  },
});
