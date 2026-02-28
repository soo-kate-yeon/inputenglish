"use client";

import { Suspense, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  extractVideoId,
  parseTranscriptToSentences,
} from "@shadowoo/shared";
import type { TranscriptItem, Sentence, LearningSession, SceneRecommendation, SceneAnalysisResponse } from "@shadowoo/shared";
import { useSentenceEditor } from "./hooks/useSentenceEditor";
import { useTranscriptFetch } from "./hooks/useTranscriptFetch";
import { SentenceItem } from "./components/SentenceItem";
import { VideoListModal } from "./components/VideoListModal";
import { AdminHeader } from "./components/AdminHeader";
import { VideoPlayerPanel } from "./components/VideoPlayerPanel";
import { RawScriptEditor } from "./components/RawScriptEditor";
import { SentenceListEditor } from "./components/SentenceListEditor";
import { SessionCreator } from "./components/SessionCreator";
import YouTubePlayer from "@/components/YouTubePlayer";
import { createClient } from "@/utils/supabase/client";

import { useSearchParams } from "next/navigation";

function AdminPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("id");

  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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

  // Scene Analysis State
  const [analyzingScenes, setAnalyzingScenes] = useState(false);
  const [analyzedScenes, setAnalyzedScenes] = useState<SceneRecommendation[]>(
    [],
  );

  const getVideoId = () => extractVideoId(youtubeUrl);

  const handlePlayerReady = (playerInstance: YT.Player) => {
    setPlayer(playerInstance);
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  // --- Edit Mode & Draft Logic ---

  // 1. Initial Load: Check for Edit ID first, then Draft
  useEffect(() => {
    const init = async () => {
      // A. Edit Mode (High Priority)
      if (editId) {
        setLoading(true);
        const { data, error } = await supabase
          .from("curated_videos")
          .select("*")
          .eq("video_id", editId)
          .single();

        if (data) {
          setYoutubeUrl(
            data.youtube_url || `https://youtu.be/${data.video_id}`,
          );
          setTitle(data.title || "");
          setDifficulty(data.difficulty || "intermediate");
          setTags(data.tags?.join(", ") || "");
          setSentences(data.transcript || []);
          // Reconstruct raw script if possible, or leave empty
          setLastSyncTime(data.snippet_end_time || 0);
          console.log("Loaded video for editing:", data.title);

          // Fetch existing learning sessions
          const { data: sessionData } = await supabase
            .from("learning_sessions")
            .select("*")
            .eq("source_video_id", editId)
            .order("order_index", { ascending: true });

          if (sessionData) {
            // Reconstruct sentences for each session using sentence_ids
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
              } as LearningSession;
            });

            setCreatedSessions(sessionsWithSentences);
            console.log(
              `Loaded ${sessionsWithSentences.length} existing sessions`,
            );
          }
        } else {
          console.error("Video not found for editing");
        }
        setLoading(false);
        return;
      }
    };

    init();
  }, [editId]); // Run only on mount or if editId changes

  // Draft auto-save removed - using manual save only to prevent conflicts

  // --- CMS List Logic ---
  const [showList, setShowList] = useState(false);
  const [existingVideos, setExistingVideos] = useState<any[]>([]);

  const fetchExistingVideos = async () => {
    const { data, error } = await supabase
      .from("curated_videos")
      .select("video_id, title, created_at")
      .order("created_at", { ascending: false });

    if (data) {
      setExistingVideos(data);
      setShowList(true);
    }
  };

  // --- Scene Analysis Logic ---
  const handleAnalyzeScenes = async () => {
    setAnalyzingScenes(true);
    try {
      const response = await fetch("/api/admin/analyze-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentences }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to analyze scenes");
      }

      const data: SceneAnalysisResponse = await response.json();
      setAnalyzedScenes(data.scenes);

      // Scroll to session creator to show results
      setTimeout(() => {
        const element = document.getElementById("session-creator-section");
        element?.scrollIntoView({ behavior: "smooth" });
      }, 100);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: any) {
      console.error("Scene analysis error:", err.message);
      // Error will be shown via transcriptFetch.error state in UI
    } finally {
      setAnalyzingScenes(false);
    }
  };

  // --- Translation Logic ---
  const handleAutoTranslate = async () => {
    try {
      const translated = await transcriptFetch.autoTranslate(sentences);
      setSentences(translated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: any) {
      if (err.message !== "Translation cancelled") {
        // Ignore cancellation, show other errors
        console.error(err.message);
      }
    }
  };

  // --- Refine Script Logic ---
  const handleRefineScript = () => {
    // Remove non-speech text like >, [Music], [Applause], etc.
    const refined = rawScript
      .replace(/^>.*$/gm, "") // Remove lines starting with >
      .replace(/\[.*?\]/g, "") // Remove [Music], [Applause], etc.
      .replace(/\n\s*\n/g, "\n") // Remove extra blank lines
      .trim();

    setRawScript(refined);
  };

  // --- Fetch Transcript Logic ---
  const handleFetchTranscript = async () => {
    const videoId = getVideoId();
    try {
      const rawText = await transcriptFetch.fetchTranscript(videoId || "");
      setRawScript(rawText);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: any) {
      console.error(err.message);
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
    } catch (err: any) {
      console.error(err.message);
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

    if (cursorPosition === 0) return; // Nothing selected

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

      // 1. Sync Trigger (Only in Raw Script Textarea or at Body level)
      // We allow this specific shortcut in the script textarea for workflow speed
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

      // 2. Video Navigation (Arrow Keys) - Only when NOT editing text
      if (!isInput && player) {
        if (e.key === "ArrowLeft") {
          e.preventDefault(); // Prevent scroll
          const currentTime = player.getCurrentTime();
          player.seekTo(Math.max(0, currentTime - 5), true);
        }
        if (e.key === "ArrowRight") {
          e.preventDefault(); // Prevent scroll
          const currentTime = player.getCurrentTime();
          player.seekTo(Math.min(player.getDuration(), currentTime + 5), true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [player, rawScript, lastSyncTime]);

  // Sentence CRUD operations moved to useSentenceEditor hook

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

      // USING DIRECT SUPABASE UPSERT (Bypassing API for full Admin power)
      const payload = {
        video_id: videoId,
        source_url: youtubeUrl,
        title: title || `Video ${videoId}`, // Use provided title or fallback to video ID
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
        created_by: user?.id,
      };

      // Use upsert matching video_id
      const { error: dbError } = await supabase
        .from("curated_videos")
        .upsert(payload, { onConflict: "video_id" });

      if (dbError) throw dbError;

      // 2. Save Sessions via API
      if (createdSessions.length > 0) {
        const sessionsResponse = await fetch("/api/admin/learning-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            source_video_id: videoId,
            sessions: createdSessions,
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

      // If editing, may be stay on page? If new, maybe clear?
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
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen overflow-auto flex flex-col"
      style={{ backgroundColor: "#faf9f5", padding: 24 }}
    >
      <div
        className="max-w-[1920px] mx-auto w-full flex flex-col"
        style={{ gap: 24 }}
      >
        <AdminHeader
          youtubeUrl={youtubeUrl}
          title={title}
          difficulty={difficulty}
          tags={tags}
          loading={loading}
          sentencesCount={sentences.length}
          onYoutubeUrlChange={setYoutubeUrl}
          onTitleChange={setTitle}
          onDifficultyChange={setDifficulty}
          onTagsChange={setTags}
          onSave={handleSave}
          onLoadExisting={fetchExistingVideos}
        />

        {transcriptFetch.error && (
          <div
            className="rounded-lg shrink-0"
            style={{
              backgroundColor: "rgba(207, 30, 41, 0.1)",
              border: "1px solid #cf1e29",
              padding: 12,
            }}
          >
            <p className="text-sm" style={{ color: "#cf1e29" }}>
              {transcriptFetch.error}
            </p>
          </div>
        )}

        {success && (
          <div
            className="rounded-lg shrink-0"
            style={{
              backgroundColor: "rgba(0, 137, 60, 0.1)",
              border: "1px solid #00893c",
              padding: 12,
            }}
          >
            <p className="text-sm" style={{ color: "#00893c" }}>
              ✅ Saved successfully!
            </p>
          </div>
        )}

        {/* 2x2 Grid Layout */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "auto 1fr",
            gap: 24,
            minHeight: "calc(100vh - 200px)",
          }}
        >
          {/* Row 1, Col 1: Player */}
          <div style={{ gridRow: 1, gridColumn: 1 }}>
            <VideoPlayerPanel
              videoId={getVideoId()}
              currentTime={currentTime}
              lastSyncTime={lastSyncTime}
              onReady={handlePlayerReady}
              onTimeUpdate={handleTimeUpdate}
            />
          </div>

          {/* Row 1, Col 2: Step 1 Raw Script - Accordion */}
          <div
            className="transition-all duration-500 ease-in-out flex flex-col"
            style={{
              gridRow: 1,
              gridColumn: 2,
              minHeight: sentences.length === 0 ? 600 : 200,
            }}
          >
            <RawScriptEditor
              rawScript={rawScript}
              loading={loading}
              youtubeUrl={youtubeUrl}
              onChange={setRawScript}
              onFetchTranscript={handleFetchTranscript}
              onRefineScript={handleRefineScript}
              scriptRef={scriptRef}
            />
          </div>

          {/* Row 2, Col 1: Step 2 Parsed Sentences */}
          <div style={{ gridRow: 2, gridColumn: 1, minHeight: 400 }}>
            <SentenceListEditor
              sentences={sentences}
              loading={loading}
              rawScript={rawScript}
              onParseScript={handleParseScript}
              onAutoTranslate={handleAutoTranslate}
              onAnalyzeScenes={handleAnalyzeScenes}
              analyzingScenes={analyzingScenes}
              onUpdateTime={updateSentenceTime}
              onUpdateText={updateSentenceText}
              onDelete={deleteSentence}
              onSplit={splitSentence}
              onMergeWithPrevious={mergeWithPrevious}
              onPlayFrom={handlePlayFrom}
            />
          </div>

          {/* Row 2, Col 2: Step 3 Create Sessions - Accordion */}
          <div
            id="session-creator-section"
            className="transition-all duration-500 ease-in-out flex flex-col"
            style={{
              gridRow: 2,
              gridColumn: 2,
              minHeight: sentences.length > 0 ? 600 : 200,
            }}
          >
            <SessionCreator
              sentences={sentences}
              videoId={getVideoId() || ""}
              onSessionsChange={setCreatedSessions}
              initialSessions={createdSessions}
              suggestedScenes={analyzedScenes}
            />
          </div>
        </div>

        {/* Bottom padding for scroll */}
        <div style={{ height: 24 }} />
      </div>

      <VideoListModal
        show={showList}
        videos={existingVideos}
        onClose={() => setShowList(false)}
        onSelect={(videoId) => (window.location.href = `/admin?id=${videoId}`)}
      />
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminPageContent />
    </Suspense>
  );
}
