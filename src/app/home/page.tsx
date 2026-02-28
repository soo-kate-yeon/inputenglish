"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SessionCard from "@/components/SessionCard";
import { useStore } from "@/lib/store";
import TopNav from "@/components/TopNav";
import VideoCard from "@/components/VideoCard";
import { usePrefetch } from "@/hooks/usePrefetch";
import { useAuth } from "@/hooks/useAuth";
import GuestViewOverlay from "@/components/home/GuestViewOverlay";

export default function HomePage() {
  const router = useRouter();
  const { prefetchVideo, prefetchSession } = usePrefetch();
  const { user, isLoading: isAuthLoading } = useAuth();
  const sessions = useStore((state) => state.sessions);
  const removeSession = useStore((state) => state.removeSession);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(
    new Set(),
  );

  // Curated videos state
  const [learningSessions, setLearningSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");

  // Hydration fix
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch learning sessions
  useEffect(() => {
    const abortController = new AbortController();

    const fetchSessions = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (selectedDifficulty !== "all") {
          params.append("difficulty", selectedDifficulty);
        }

        const response = await fetch(`/api/learning-sessions?${params}`, {
          signal: abortController.signal,
        });
        if (!response.ok) {
          // API error (e.g. Supabase unreachable) — silently fall back to empty
          if (!abortController.signal.aborted) {
            setLearningSessions([]);
          }
          return;
        }

        const data = await response.json();
        if (!abortController.signal.aborted) {
          setLearningSessions(data.sessions || []);
        }
      } catch (error) {
        if (
          !abortController.signal.aborted &&
          (error as Error).name !== "AbortError"
        ) {
          // Network error — silently fall back to empty
          setLearningSessions([]);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchSessions();

    return () => {
      abortController.abort();
    };
  }, [selectedDifficulty]);

  // Derived State
  const recentSessions = Object.values(sessions).sort(
    (a, b) => b.lastAccessedAt - a.lastAccessedAt,
  );

  if (!isMounted || isAuthLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-bg-default">
        <TopNav />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-text-subtle">Loading...</p>
        </main>
      </div>
    );
  }

  const isGuest = !user;
  const showContinueLearning = !isGuest && recentSessions.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-bg-default">
      <TopNav />

      <main className="flex-1">
        {/* Continue Learning — horizontal scroll, only for logged-in users with sessions */}
        {showContinueLearning && (
          <section
            className="px-6 py-5 border-border-default"
            style={{
              borderBottomWidth: "var(--border-width-default)",
              borderBottomStyle: "solid",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-text-default">
                계속 학습하기
              </h2>
              <div className="flex items-center gap-2">
                {isEditMode ? (
                  <>
                    <button
                      onClick={() => {
                        if (selectedVideoIds.size === recentSessions.length) {
                          setSelectedVideoIds(new Set());
                        } else {
                          setSelectedVideoIds(
                            new Set(recentSessions.map((s) => s.videoId)),
                          );
                        }
                      }}
                      className="text-sm font-medium transition-colors px-3 py-2 text-text-muted"
                    >
                      {selectedVideoIds.size === recentSessions.length
                        ? "전체 해제"
                        : "전체 선택"}
                    </button>
                    <button
                      onClick={async () => {
                        if (selectedVideoIds.size === 0) return;
                        const idsToDelete = Array.from(selectedVideoIds);
                        for (const videoId of idsToDelete) {
                          await removeSession(videoId);
                        }
                        setSelectedVideoIds(new Set());
                        setIsEditMode(false);
                      }}
                      disabled={selectedVideoIds.size === 0}
                      className={`text-sm font-medium rounded-lg transition-colors px-3 py-2 ${
                        selectedVideoIds.size > 0
                          ? "bg-error-subtle text-error-text cursor-pointer"
                          : "bg-bg-subtle text-text-subtle cursor-not-allowed"
                      }`}
                    >
                      삭제
                      {selectedVideoIds.size > 0 &&
                        ` (${selectedVideoIds.size})`}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditMode(false);
                        setSelectedVideoIds(new Set());
                      }}
                      className="text-sm font-medium transition-colors px-3 py-2 text-text-muted"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="text-sm font-medium transition-colors px-3 py-2 text-text-muted"
                  >
                    편집
                  </button>
                )}
              </div>
            </div>

            {/* Horizontal scroll container */}
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-6 px-6">
              {recentSessions.map((session) => {
                const learningSession = learningSessions.find(
                  (s) => s.source_video_id === session.videoId,
                );
                const isSelected = selectedVideoIds.has(session.videoId);

                return (
                  <SessionCard
                    key={session.id}
                    title={learningSession?.title || `Video ${session.videoId}`}
                    thumbnailUrl={
                      learningSession?.thumbnail_url ||
                      `https://img.youtube.com/vi/${session.videoId}/hqdefault.jpg`
                    }
                    isEditMode={isEditMode}
                    isSelected={isSelected}
                    onToggleSelection={() => {
                      const newSelected = new Set(selectedVideoIds);
                      if (isSelected) {
                        newSelected.delete(session.videoId);
                      } else {
                        newSelected.add(session.videoId);
                      }
                      setSelectedVideoIds(newSelected);
                    }}
                    onClick={() => {
                      router.push(
                        `/listening/${session.videoId}${learningSession ? `?sessionId=${learningSession.id}` : ""}`,
                      );
                    }}
                    onMouseEnter={() => {
                      prefetchVideo(session.videoId);
                      if (learningSession) {
                        prefetchSession(learningSession.id);
                      }
                    }}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Video Gallery */}
        <section className="px-6 py-6">
          {/* Header + Filter */}
          <div className="mb-6">
            <h2 className="text-xl font-extrabold text-text-default mb-4">
              어떤 영상으로 쉐도잉을 해보시겠어요?
            </h2>

            {/* Difficulty Filter — bold-line style */}
            <div className="flex gap-2">
              {[
                { id: "all", label: "전체" },
                { id: "beginner", label: "초급" },
                { id: "intermediate", label: "중급" },
                { id: "advanced", label: "고급" },
              ].map((cat) => {
                const isActive = selectedDifficulty === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedDifficulty(cat.id)}
                    className={`flex items-center rounded-lg text-sm font-medium transition-colors px-3 py-2 ${
                      isActive
                        ? "bg-bg-inverse text-text-inverse"
                        : "bg-transparent text-text-muted border-border-default"
                    }`}
                    style={
                      isActive
                        ? undefined
                        : {
                            borderWidth: "var(--border-width-default)",
                            borderStyle: "solid",
                          }
                    }
                  >
                    {isActive && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="mr-1.5"
                      >
                        <path
                          d="M13.3333 4L6 11.3333L2.66667 8"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.6"
                        />
                      </svg>
                    )}
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Responsive Video Grid */}
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <p className="text-text-subtle">Loading...</p>
            </div>
          ) : learningSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-text-subtle">
              <p>큐레이션된 학습 세션이 없어요.</p>
              <Link
                href="/admin"
                className="hover:underline text-text-brand mt-2"
              >
                + 세션 추가하기
              </Link>
            </div>
          ) : (
            <div className="relative">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {learningSessions.map((session) => (
                  <VideoCard
                    key={session.id}
                    title={session.title}
                    thumbnailUrl={session.thumbnail_url}
                    duration={`${Math.floor(session.duration / 60)}:${String(Math.floor(session.duration % 60)).padStart(2, "0")}`}
                    description={session.description || ""}
                    sentenceCount={session.sentence_ids?.length || 0}
                    onClick={() => {
                      if (isGuest) return;
                      router.push(
                        `/listening/${session.source_video_id}?sessionId=${session.id}`,
                      );
                    }}
                    onMouseEnter={() => {
                      if (isGuest) return;
                      prefetchVideo(session.source_video_id);
                      prefetchSession(session.id);
                    }}
                  />
                ))}
              </div>
              {isGuest && (
                <div
                  className="absolute inset-0 pointer-events-none rounded-xl"
                  style={{
                    background:
                      "linear-gradient(to bottom, transparent 30%, var(--color-bg-default))",
                  }}
                />
              )}
            </div>
          )}
        </section>
      </main>

      {isMounted && isGuest && <GuestViewOverlay />}
    </div>
  );
}
