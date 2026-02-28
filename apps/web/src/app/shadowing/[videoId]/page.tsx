"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { groupSentencesByMode } from "@shadowoo/shared";
import type { Sentence, LearningSession } from "@shadowoo/shared";
import { useQuery } from "@tanstack/react-query";
import YouTubePlayer from "@/components/YouTubePlayer";
import { ShadowingHeader } from "@/components/shadowing/ShadowingHeader";
import { ShadowingScriptList } from "@/components/shadowing/ShadowingScriptList";
import { RecordingBar } from "@/components/shadowing/RecordingBar";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { Check } from "lucide-react";

export default function ShadowingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoId = params?.videoId as string;
  const sessionId = searchParams?.get("sessionId");

  const [error, setError] = useState<string | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [mode, setMode] = useState<"sentence" | "paragraph" | "total">(
    "sentence",
  );

  // Player State
  const [player, setPlayer] = useState<YT.Player | null>(null);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const playTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Loop State
  const [loopingSentenceId, setLoopingSentenceId] = useState<string | null>(
    null,
  );

  // Audio Recording Hook
  const {
    recordingState,
    duration: recordingDuration,
    isPlaying: isRecordingPlaying,
    playbackProgress,
    startRecording,
    stopRecording,
    playRecording,
    pauseRecording,
    resetRecording,
  } = useAudioRecorder();

  // Data Fetching with useQuery
  const { data: sessionData, isLoading: isLoadingSession } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const response = await fetch(
        `/api/learning-sessions?sessionId=${sessionId}`,
      );
      if (!response.ok) throw new Error("Session not found");
      const result = await response.json();
      return result.sessions?.[0] as LearningSession;
    },
    enabled: !!sessionId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: curatedVideoData, isLoading: isLoadingVideo } = useQuery({
    queryKey: ["video", videoId],
    queryFn: async () => {
      const response = await fetch(`/api/curated-videos/${videoId}`);
      if (!response.ok) throw new Error("Failed to fetch curated video");
      return response.json();
    },
    enabled: !sessionId && !!videoId,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = sessionId ? isLoadingSession : isLoadingVideo;

  // Derived video data and sentences
  const videoData = sessionId
    ? sessionData
      ? {
          title: sessionData.title,
          snippet_start_time: sessionData.start_time,
          snippet_end_time: sessionData.end_time,
          snippet_duration: sessionData.duration,
        }
      : null
    : curatedVideoData;

  const rawSentences = sessionId
    ? sessionData?.sentences || []
    : curatedVideoData?.transcript || [];

  useEffect(() => {
    if (rawSentences.length > 0) {
      setSentences(groupSentencesByMode(rawSentences, mode));
    }
  }, [mode, rawSentences]);

  const handlePlayerReady = (playerInstance: YT.Player) => {
    setPlayer(playerInstance);
  };

  const handlePlaySentence = (startTime: number, endTime: number) => {
    if (!player) return;

    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
    }

    const sentence = sentences.find((s) => s.startTime === startTime);
    if (sentence) {
      setCurrentPlayingId(sentence.id);
    }

    player.seekTo(startTime, true);
    player.playVideo();

    const duration = (endTime - startTime) * 1000;
    playTimeoutRef.current = setTimeout(() => {
      player.pauseVideo();
      setCurrentPlayingId(null);
    }, duration);
  };

  const handleLoopSentence = (sentenceId: string, isLooping: boolean) => {
    if (isLooping) {
      setLoopingSentenceId(sentenceId);
      const sentence = sentences.find((s) => s.id === sentenceId);
      if (sentence && player) {
        player.seekTo(sentence.startTime, true);
        player.playVideo();
      }
    } else {
      setLoopingSentenceId(null);
    }
  };

  // Loop playback effect
  useEffect(() => {
    if (!loopingSentenceId || !player) return;

    const loopingSentence = sentences.find((s) => s.id === loopingSentenceId);
    if (!loopingSentence) return;

    const checkLoop = setInterval(() => {
      if (player && player.getCurrentTime) {
        const currentTime = player.getCurrentTime();
        if (currentTime >= loopingSentence.endTime) {
          player.seekTo(loopingSentence.startTime, true);
          player.playVideo();
        }
      }
    }, 100);

    return () => clearInterval(checkLoop);
  }, [loopingSentenceId, player, sentences]);

  const handleRecordSentence = async (sentenceId: string) => {
    // 1. 영상 재생 중지
    if (player) {
      player.pauseVideo();
      setCurrentPlayingId(null);
    }

    // 2. 루프 해제
    if (loopingSentenceId) {
      setLoopingSentenceId(null);
    }

    // 3. 녹음 시작 (startRecording 내부에서 이전 녹음 정리)
    await startRecording();
  };

  // 다시 녹음 핸들러 (RecordingBar에서 사용)
  const handleReRecord = async () => {
    // 영상 정지
    if (player) {
      player.pauseVideo();
      setCurrentPlayingId(null);
    }
    // 루프 해제
    if (loopingSentenceId) {
      setLoopingSentenceId(null);
    }
    // 녹음 시작
    await startRecording();
  };

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ backgroundColor: "#faf9f5", color: "#72716e" }}
      >
        Loading Shadowing...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center h-screen"
        style={{ backgroundColor: "#faf9f5", gap: 16 }}
      >
        <p style={{ color: "#cf1e29" }}>{error}</p>
        <button
          onClick={() => router.push("/home")}
          className="hover:underline"
          style={{ color: "#b45000" }}
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ backgroundColor: "#faf9f5" }}
    >
      {/* Header */}
      <ShadowingHeader
        title={videoData?.title || "Loading..."}
        onBack={() => router.push("/home")}
        onPrevStep={() =>
          router.push(
            `/listening/${videoId}${sessionId ? `?sessionId=${sessionId}` : ""}`,
          )
        }
        onNextStep={() => {}} // TODO: Next step
      />

      <main
        className="flex-1 h-[calc(100vh-56px)] overflow-hidden"
        style={{ padding: 24 }}
      >
        <div className="h-full flex" style={{ gap: 24 }}>
          {/* Left: Video Player */}
          <div className="flex-1 h-full flex flex-col">
            <div
              className="relative w-full aspect-video overflow-hidden"
              style={{
                backgroundColor: "#0c0b09",
                borderRadius: 16,
                boxShadow:
                  "0 4px 6px -2px rgba(0, 0, 0, 0.1), 0 10px 15px -3px rgba(0, 0, 0, 0.05)",
              }}
            >
              <YouTubePlayer
                videoId={videoId}
                className="w-full h-full"
                onReady={handlePlayerReady}
                disableSpacebarControl={true}
                startSeconds={videoData?.snippet_start_time}
                endSeconds={videoData?.snippet_end_time}
              />
            </div>
          </div>

          {/* Right: Shadowing Script & Tools */}
          <div
            className="flex-1 h-full overflow-hidden flex flex-col"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 16,
              border: "1px solid #dfdedb",
              padding: 24,
            }}
          >
            {/* Mode Toggles */}
            <div
              className="flex shrink-0"
              style={{ gap: 12, marginBottom: 24 }}
            >
              <button
                onClick={() => setMode("sentence")}
                className={`flex items-center font-medium transition-colors ${mode === "sentence" ? "" : ""}`}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 14,
                  gap: 8,
                  backgroundColor: mode === "sentence" ? "#0c0b09" : "#f0efeb",
                  color: mode === "sentence" ? "#faf9f5" : "#72716e",
                }}
                onMouseEnter={(e) => {
                  if (mode !== "sentence") {
                    e.currentTarget.style.backgroundColor = "#dfdedb";
                  }
                }}
                onMouseLeave={(e) => {
                  if (mode !== "sentence") {
                    e.currentTarget.style.backgroundColor = "#f0efeb";
                  }
                }}
              >
                {mode === "sentence" && <Check className="w-4 h-4" />}한 문장씩
              </button>
              <button
                onClick={() => setMode("paragraph")}
                className="flex items-center font-medium transition-colors"
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 14,
                  gap: 8,
                  backgroundColor: mode === "paragraph" ? "#0c0b09" : "#f0efeb",
                  color: mode === "paragraph" ? "#faf9f5" : "#72716e",
                }}
                onMouseEnter={(e) => {
                  if (mode !== "paragraph") {
                    e.currentTarget.style.backgroundColor = "#dfdedb";
                  }
                }}
                onMouseLeave={(e) => {
                  if (mode !== "paragraph") {
                    e.currentTarget.style.backgroundColor = "#f0efeb";
                  }
                }}
              >
                {mode === "paragraph" && <Check className="w-4 h-4" />}한 문단씩
              </button>
              <button
                onClick={() => setMode("total")}
                className="flex items-center font-medium transition-colors"
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 14,
                  gap: 8,
                  backgroundColor: mode === "total" ? "#0c0b09" : "#f0efeb",
                  color: mode === "total" ? "#faf9f5" : "#72716e",
                }}
                onMouseEnter={(e) => {
                  if (mode !== "total") {
                    e.currentTarget.style.backgroundColor = "#dfdedb";
                  }
                }}
                onMouseLeave={(e) => {
                  if (mode !== "total") {
                    e.currentTarget.style.backgroundColor = "#f0efeb";
                  }
                }}
              >
                {mode === "total" && <Check className="w-4 h-4" />}
                전체
              </button>
            </div>

            {/* Script List */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ paddingBottom: 80 }}
            >
              <ShadowingScriptList
                sentences={sentences}
                mode={mode}
                onPlaySentence={handlePlaySentence}
                onLoopSentence={handleLoopSentence}
                onRecordSentence={handleRecordSentence}
                loopingSentenceId={loopingSentenceId}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Recording Bar */}
      <RecordingBar
        state={recordingState}
        onRecord={handleReRecord}
        onStop={stopRecording}
        onPlay={playRecording}
        onPause={pauseRecording}
        onCancel={resetRecording}
        onDone={resetRecording}
        isPlaying={isRecordingPlaying}
        recordingDuration={recordingDuration}
        playbackProgress={playbackProgress}
      />
    </div>
  );
}
