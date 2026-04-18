"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { extractVideoId, normalizeYouTubeUrl } from "@inputenglish/shared";
import type {
  Sentence,
  LearningSession,
  SceneRecommendation,
  SceneAnalysisResponse,
} from "@inputenglish/shared";
import { useSentenceEditor } from "./hooks/useSentenceEditor";
import { useTranscriptFetch } from "./hooks/useTranscriptFetch";
import {
  VideoListModal,
  type ExistingVideo,
} from "./components/VideoListModal";
import { AdminHeader } from "./components/AdminHeader";
import { VideoPlayerPanel } from "./components/VideoPlayerPanel";
import { RawScriptEditor } from "./components/RawScriptEditor";
import { SentenceListEditor } from "./components/SentenceListEditor";
import { SessionCreator } from "./components/SessionCreator";
import { AdminAuthGate } from "./components/AdminAuthGate";
import { createClient } from "@/utils/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { useSearchParams } from "next/navigation";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Parse "mm:ss" or "hh:mm:ss" or plain seconds to seconds */
function parseTimeToSeconds(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return 0;
  const parts = trimmed.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(trimmed) || 0;
}

function AdminPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("id");

  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use custom hooks
  const transcriptFetch = useTranscriptFetch();

  // Form state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<
    "beginner" | "intermediate" | "advanced"
  >("intermediate");
  const [tags, setTags] = useState("");

  // Raw Script State
  const [rawScript, setRawScript] = useState("");
  const scriptRef = useRef<HTMLTextAreaElement>(null);
  const [transcriptStartTime, setTranscriptStartTime] = useState("");
  const [transcriptEndTime, setTranscriptEndTime] = useState("");

  // Sync Editor State (using custom hook)
  const {
    sentences,
    setSentences,
    updateSentenceTime,
    updateSentenceText,
    deleteSentence,
    splitSentence,
    mergeWithPrevious,
  } = useSentenceEditor([]);
  const [player, setPlayer] = useState<YT.Player | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const [lastSyncTime, setLastSyncTime] = useState(0);

  // Session Creation State
  const [createdSessions, setCreatedSessions] = useState<LearningSession[]>([]);
  const [highlightedSentenceIds, setHighlightedSentenceIds] = useState<
    Set<string>
  >(new Set());
  const [selectedSentenceIds, setSelectedSentenceIds] = useState<Set<string>>(
    new Set(),
  );

  const handleSentenceSelect = (id: string) => {
    setSelectedSentenceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Translation State
  const [translating, setTranslating] = useState(false);

  // Scene Analysis State
  const [analyzingScenes, setAnalyzingScenes] = useState(false);
  const [analyzedScenes, setAnalyzedScenes] = useState<SceneRecommendation[]>(
    [],
  );

  const getVideoId = () => extractVideoId(youtubeUrl);

  const handleYoutubeUrlChange = (nextUrl: string) => {
    setYoutubeUrl(normalizeYouTubeUrl(nextUrl));
  };

  const handlePlayerReady = (playerInstance: YT.Player) => {
    setPlayer(playerInstance);
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  // --- Edit Mode & Draft Logic ---
  useEffect(() => {
    const init = async () => {
      if (editId) {
        setLoading(true);
        setErrorMessage(null);
        try {
          const { data, error } = await supabase
            .from("curated_videos")
            .select("*")
            .eq("video_id", editId)
            .single();

          if (error) {
            setErrorMessage(`Failed to load video: ${error.message}`);
            return;
          }

          if (data) {
            setYoutubeUrl(
              normalizeYouTubeUrl(
                data.youtube_url || `https://youtu.be/${data.video_id}`,
              ),
            );
            setTitle(data.title || "");
            setDifficulty(data.difficulty || "intermediate");
            setTags(data.tags?.join(", ") || "");
            setSentences(data.transcript || []);
            setLastSyncTime(data.snippet_end_time || 0);
            console.log("Loaded video for editing:", data.title);

            const { data: sessionData } = await supabase
              .from("learning_sessions")
              .select(
                `
                *,
                context:session_contexts (
                  session_id,
                  strategic_intent,
                  reusable_scenarios,
                  key_vocabulary,
                  grammar_rhetoric_note,
                  expected_takeaway,
                  generated_by,
                  updated_by,
                  created_at,
                  updated_at
                )
              `,
              )
              .eq("source_video_id", editId)
              .order("order_index", { ascending: true });

            if (sessionData) {
              const sessionsWithSentences = sessionData.map((session) => {
                const sessionSentences = session.sentence_ids
                  .map((id: string) =>
                    data.transcript?.find((s: Sentence) => s.id === id),
                  )
                  .filter(
                    (s: Sentence | undefined): s is Sentence => s !== undefined,
                  );

                return {
                  ...session,
                  sentences: sessionSentences,
                  context: Array.isArray(session.context)
                    ? (session.context[0] ?? null)
                    : (session.context ?? null),
                } as LearningSession;
              });

              setCreatedSessions(sessionsWithSentences);
            }
          } else {
            setErrorMessage("Video not found for editing.");
          }
        } catch (err) {
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to load video data.",
          );
        } finally {
          setLoading(false);
        }
        return;
      }
    };

    init();
  }, [editId]);

  // --- CMS List Logic ---
  const [showList, setShowList] = useState(false);
  const [existingVideos, setExistingVideos] = useState<ExistingVideo[]>([]);

  const fetchExistingVideos = async () => {
    // Fetch videos
    const { data: videos } = await supabase
      .from("curated_videos")
      .select("video_id, title, created_at")
      .order("created_at", { ascending: false });

    if (!videos) return;

    // Fetch all sessions
    const { data: sessions } = await supabase
      .from("learning_sessions")
      .select(
        "id, source_video_id, title, duration, difficulty, order_index, created_at",
      )
      .order("order_index", { ascending: true });

    const sessionsByVideo = new Map<string, typeof sessions>();
    for (const s of sessions ?? []) {
      const list = sessionsByVideo.get(s.source_video_id) ?? [];
      list.push(s);
      sessionsByVideo.set(s.source_video_id, list);
    }

    setExistingVideos(
      videos.map((v) => ({
        ...v,
        sessions: (sessionsByVideo.get(v.video_id) ?? []).map((s) => ({
          id: s.id,
          source_video_id: s.source_video_id,
          title: s.title,
          duration: Number(s.duration),
          difficulty: s.difficulty ?? undefined,
          order_index: s.order_index,
          created_at: s.created_at,
        })),
      })),
    );
    setShowList(true);
  };

  const handleDeleteSession = async (sessionId: string) => {
    const { error: deleteError } = await supabase
      .from("learning_sessions")
      .delete()
      .eq("id", sessionId);

    if (deleteError) {
      console.error("Failed to delete session:", deleteError.message);
      return;
    }

    // Update local state
    setExistingVideos((prev) =>
      prev.map((v) => ({
        ...v,
        sessions: v.sessions.filter((s) => s.id !== sessionId),
      })),
    );
  };

  // --- Scene Analysis Logic ---
  const handleAnalyzeScenes = async () => {
    setAnalyzingScenes(true);
    try {
      const response = await fetch("/api/admin/analyze-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sentences }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to analyze scenes");
      }

      const data: SceneAnalysisResponse = await response.json();
      setAnalyzedScenes(data.scenes);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scene analysis failed.";
      console.error("Scene analysis error:", msg);
      setErrorMessage(msg);
    } finally {
      setAnalyzingScenes(false);
    }
  };

  // --- Translation Logic ---
  const handleTranslateSelected = async (sentenceIds: string[]) => {
    setTranslating(true);
    try {
      const selected = sentences.filter((s) => sentenceIds.includes(s.id));
      if (selected.length === 0) return;
      const translated = await transcriptFetch.autoTranslate(selected);
      const translationMap = new Map(
        translated.map((s) => [s.id, s.translation]),
      );
      setSentences((prev) =>
        prev.map((s) =>
          translationMap.has(s.id)
            ? { ...s, translation: translationMap.get(s.id) }
            : s,
        ),
      );
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: unknown) {
      if (err instanceof Error && err.message !== "Translation cancelled") {
        console.error(err.message);
        setErrorMessage(err.message);
      }
    } finally {
      setTranslating(false);
    }
  };

  // --- Refine Script Logic ---
  const handleRefineScript = () => {
    setRawScript(rawScript.replace(/>>/g, ""));
  };

  // --- Fetch Transcript Logic ---
  const handleFetchTranscript = async () => {
    const videoId = getVideoId();
    try {
      const timeRange: { startTime?: number; endTime?: number } = {};
      if (transcriptStartTime) {
        timeRange.startTime = parseTimeToSeconds(transcriptStartTime);
      }
      if (transcriptEndTime) {
        timeRange.endTime = parseTimeToSeconds(transcriptEndTime);
      }
      const rawText = await transcriptFetch.fetchTranscript(
        videoId || "",
        Object.keys(timeRange).length > 0 ? timeRange : undefined,
      );
      setRawScript(rawText);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err.message);
        setErrorMessage(err.message);
      }
    }
  };

  // --- Parse Script Logic ---
  const handleParseScript = async () => {
    const videoId = getVideoId();
    try {
      const parsedSentences = await transcriptFetch.parseScript(
        rawScript,
        videoId,
      );
      setSentences(parsedSentences);
      setLastSyncTime(
        parsedSentences[parsedSentences.length - 1]?.endTime || 0,
      );
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err.message);
        setErrorMessage(err.message);
      }
    }
  };

  const handlePlayFrom = (time: number) => {
    if (!player) return;
    player.seekTo(time, true);
    player.playVideo();
  };

  // --- Sync Logic ---
  const handleSyncTrigger = () => {
    if (!player || !scriptRef.current) return;

    const textarea = scriptRef.current;
    const cursorPosition = textarea.selectionStart;

    if (cursorPosition === 0) return;

    const fullText = rawScript;
    const splitText = fullText.substring(0, cursorPosition).trim();
    const remainingText = fullText.substring(cursorPosition).trimStart();

    if (!splitText) return;

    const currentAbsTime = parseFloat(player.getCurrentTime().toFixed(2));

    const newSentence: Sentence = {
      id: crypto.randomUUID(),
      text: splitText,
      startTime: lastSyncTime,
      endTime: currentAbsTime,
      highlights: [],
    };

    setSentences((prev) => [...prev, newSentence]);
    setLastSyncTime(currentAbsTime);
    setRawScript(remainingText);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const isScriptTextarea = target === scriptRef.current;
      const isBody = target === document.body;

      if (
        (isScriptTextarea || isBody) &&
        (e.key === "]" || e.code === "BracketRight")
      ) {
        e.preventDefault();
        handleSyncTrigger();
        return;
      }

      if (!isInput && player) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          const currentTime = player.getCurrentTime();
          player.seekTo(Math.max(0, currentTime - 5), true);
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          const currentTime = player.getCurrentTime();
          player.seekTo(Math.min(player.getDuration(), currentTime + 5), true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [player, rawScript, lastSyncTime]);

  const handleSave = async () => {
    const videoId = getVideoId();
    if (!videoId) {
      console.error("Invalid YouTube URL");
      return;
    }

    if (sentences.length === 0) {
      console.error("No parsed sentences to save");
      return;
    }

    setLoading(true);
    try {
      const duration = player
        ? player.getDuration()
        : sentences[sentences.length - 1].endTime;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const createdBy = user?.id && UUID_PATTERN.test(user.id) ? user.id : null;

      const payload = {
        video_id: videoId,
        source_url: youtubeUrl,
        title: title || `Video ${videoId}`,
        snippet_start_time: 0,
        snippet_end_time: duration,
        difficulty,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        transcript: sentences,
        attribution: "YouTube",
        created_at: new Date().toISOString(),
        created_by: createdBy,
      };

      const { error: dbError } = await supabase
        .from("curated_videos")
        .upsert(payload, { onConflict: "video_id" });

      if (dbError) {
        console.error("Curated video save failed:", {
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint,
          code: dbError.code,
          payload,
        });
        throw dbError;
      }

      if (createdSessions.length > 0) {
        const primarySpeakerSession = createdSessions.find(
          (session) =>
            session.primary_speaker_id || session.primary_speaker_name,
        );
        const sessionsResponse = await fetch("/api/admin/learning-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            source_video_id: videoId,
            sessions: createdSessions,
            primarySpeakerId: primarySpeakerSession?.primary_speaker_id ?? null,
            primarySpeakerName:
              primarySpeakerSession?.primary_speaker_name ?? "",
            primarySpeakerDescription:
              primarySpeakerSession?.primary_speaker_description ?? "",
            primarySpeakerAvatarUrl:
              primarySpeakerSession?.primary_speaker_avatar_url ?? "",
          }),
        });

        if (!sessionsResponse.ok) {
          const errorData = await sessionsResponse.json();
          console.error("Session save error details:", errorData);
          throw new Error(
            errorData.error || "Failed to save learning sessions",
          );
        }
      }

      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
        if (!editId) {
          setRawScript("");
          setYoutubeUrl("");
          setSentences([]);
          setCreatedSessions([]);
          setLastSyncTime(0);
        }
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      console.error(msg);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: "#fafafa" }}
    >
      {/* Header */}
      <AdminHeader
        youtubeUrl={youtubeUrl}
        title={title}
        difficulty={difficulty}
        tags={tags}
        loading={loading}
        sentencesCount={sentences.length}
        onYoutubeUrlChange={handleYoutubeUrlChange}
        onTitleChange={setTitle}
        onDifficultyChange={setDifficulty}
        onTagsChange={setTags}
        onSave={handleSave}
        onLoadExisting={fetchExistingVideos}
      />

      {/* Notification banners */}
      {transcriptFetch.error && (
        <div
          className="shrink-0"
          style={{
            backgroundColor: "rgba(207, 30, 41, 0.08)",
            borderBottom: "1px solid #cf1e29",
            padding: "8px 16px",
          }}
        >
          <p className="text-sm" style={{ color: "#cf1e29" }}>
            {transcriptFetch.error}
          </p>
        </div>
      )}

      {errorMessage && (
        <div
          className="shrink-0 flex items-center justify-between"
          style={{
            backgroundColor: "rgba(207, 30, 41, 0.08)",
            borderBottom: "1px solid #cf1e29",
            padding: "8px 16px",
          }}
        >
          <p className="text-sm" style={{ color: "#cf1e29" }}>
            {errorMessage}
          </p>
          <button
            className="text-xs ml-4 shrink-0"
            style={{ color: "#cf1e29", opacity: 0.7 }}
            onClick={() => setErrorMessage(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div
          className="shrink-0"
          style={{
            backgroundColor: "rgba(0, 137, 60, 0.08)",
            borderBottom: "1px solid #00893c",
            padding: "8px 16px",
          }}
        >
          <p className="text-sm" style={{ color: "#00893c" }}>
            Saved successfully!
          </p>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT PANEL */}
        <div
          className="w-1/2 flex flex-col min-h-0"
          style={{ borderRight: "1px solid #e5e5e5" }}
        >
          {/* Video Player - fixed aspect ratio */}
          <VideoPlayerPanel
            videoId={getVideoId()}
            onReady={handlePlayerReady}
            onTimeUpdate={handleTimeUpdate}
          />

          {/* Sync Info Bar */}
          <div
            className="shrink-0 flex items-center"
            style={{
              backgroundColor: "#fafafa",
              borderBottom: "1px solid #e5e5e5",
              padding: "6px 12px",
              gap: 16,
            }}
          >
            <span className="text-xs" style={{ color: "#737373" }}>
              Current:{" "}
              <span
                className="font-mono font-bold"
                style={{ color: "#171717" }}
              >
                {currentTime.toFixed(2)}s
              </span>
            </span>
            <span className="text-xs" style={{ color: "#737373" }}>
              Last Sync:{" "}
              <span className="font-mono" style={{ color: "#0a0a0a" }}>
                {lastSyncTime.toFixed(2)}s
              </span>
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="text-xs flex items-center justify-center"
                  style={{
                    width: 18,
                    height: 18,
                    backgroundColor: "#e5e5e5",
                    color: "#737373",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: "bold",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#d4d4d4";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#e5e5e5";
                  }}
                >
                  ?
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start">
                <h3
                  className="font-bold text-sm mb-2"
                  style={{ color: "#0a0a0a" }}
                >
                  How to Sync
                </h3>
                <ul
                  className="text-xs list-disc"
                  style={{
                    paddingLeft: 14,
                    color: "#737373",
                    lineHeight: 1.8,
                    gap: 4,
                  }}
                >
                  <li>Paste script into the Raw Script editor.</li>
                  <li>
                    Play video. Click in the text where the sentence ends.
                  </li>
                  <li>
                    Press{" "}
                    <kbd
                      className="font-bold text-xs"
                      style={{
                        backgroundColor: "#fafafa",
                        color: "#404040",
                        padding: "1px 5px",
                        border: "1px solid #e5e5e5",
                      }}
                    >
                      ]
                    </kbd>{" "}
                    key.
                  </li>
                  <li>Use Auto Translate to fill Korean meanings.</li>
                </ul>
              </PopoverContent>
            </Popover>
          </div>

          {/* Raw Script - fills remaining space */}
          <RawScriptEditor
            rawScript={rawScript}
            loading={loading}
            youtubeUrl={youtubeUrl}
            onChange={setRawScript}
            onFetchTranscript={handleFetchTranscript}
            onRefineScript={handleRefineScript}
            scriptRef={scriptRef}
            startTime={transcriptStartTime}
            endTime={transcriptEndTime}
            onStartTimeChange={setTranscriptStartTime}
            onEndTimeChange={setTranscriptEndTime}
          />
        </div>

        {/* RIGHT PANEL */}
        <div className="w-1/2 flex flex-col min-h-0">
          {/* Step 2: Parsed Sentences - 50% height */}
          <SentenceListEditor
            sentences={sentences}
            loading={loading}
            rawScript={rawScript}
            highlightedSentenceIds={highlightedSentenceIds}
            selectedSentenceIds={selectedSentenceIds}
            onSentenceSelect={handleSentenceSelect}
            onParseScript={handleParseScript}
            onAnalyzeScenes={handleAnalyzeScenes}
            analyzingScenes={analyzingScenes}
            onTranslateSelected={handleTranslateSelected}
            translating={translating}
            onUpdateTime={updateSentenceTime}
            onUpdateText={updateSentenceText}
            onDelete={deleteSentence}
            onSplit={splitSentence}
            onMergeWithPrevious={mergeWithPrevious}
            onPlayFrom={handlePlayFrom}
          />

          {/* Step 3: Session Creator - 50% height */}
          <SessionCreator
            sentences={sentences}
            videoId={getVideoId() || ""}
            videoTitle={title}
            selectedIds={selectedSentenceIds}
            onSelectedIdsChange={setSelectedSentenceIds}
            onSessionsChange={setCreatedSessions}
            onHighlightedSentencesChange={setHighlightedSentenceIds}
            initialSessions={createdSessions}
            suggestedScenes={analyzedScenes}
          />
        </div>
      </div>

      <VideoListModal
        show={showList}
        videos={existingVideos}
        onClose={() => setShowList(false)}
        onSelect={(videoId) => (window.location.href = `/admin?id=${videoId}`)}
        onDeleteSession={handleDeleteSession}
      />
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminAuthGate>
        <AdminPageContent />
      </AdminAuthGate>
    </Suspense>
  );
}
