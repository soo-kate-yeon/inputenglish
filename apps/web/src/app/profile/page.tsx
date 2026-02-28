"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import TopNav from "@/components/TopNav";
import { useStore } from "@/lib/store";
import AdminButton from "./AdminButton";

// Loading skeleton for profile page
function ProfileSkeleton() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#faf9f5" }}
    >
      <TopNav />
      <main className="flex-1 max-w-[480px] w-full mx-auto px-5 py-8 flex flex-col gap-5">
        {/* Profile Header Skeleton */}
        <section
          className="flex items-center gap-4 pb-5 border-b"
          style={{ borderColor: "#dfdedb" }}
        >
          <div
            className="w-14 h-14 rounded-full animate-pulse"
            style={{ backgroundColor: "#dfdedb" }}
          />
          <div className="flex-1 min-w-0 space-y-2">
            <div
              className="h-5 w-24 rounded animate-pulse"
              style={{ backgroundColor: "#dfdedb" }}
            />
            <div
              className="h-4 w-40 rounded animate-pulse"
              style={{ backgroundColor: "#dfdedb" }}
            />
          </div>
        </section>

        {/* Stats Skeleton */}
        <section className="flex gap-3">
          <div
            className="flex-1 rounded-xl p-4 h-20 animate-pulse"
            style={{ backgroundColor: "#f0efeb" }}
          />
          <div
            className="flex-1 rounded-xl p-4 h-20 animate-pulse"
            style={{ backgroundColor: "#f0efeb" }}
          />
        </section>

        {/* Menu Skeleton */}
        <section
          className="rounded-xl overflow-hidden border h-32 animate-pulse"
          style={{ backgroundColor: "#ffffff", borderColor: "#dfdedb" }}
        />
      </main>
    </div>
  );
}

export default function ProfilePage() {
  const { user, isLoading, isAuthenticated, signOut } = useAuth();
  const router = useRouter();
  const sessions = useStore((state) => state.sessions);
  const savedSentences = useStore((state) => state.savedSentences);
  const highlights = useStore((state) => state.highlights);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/home");
    }
  }, [isLoading, isAuthenticated, router]);

  const handleLogout = async () => {
    await signOut();
    router.push("/home");
    router.refresh();
  };

  const sessionsCount = Object.keys(sessions).length;
  const savedCount = savedSentences.length + highlights.length;

  // Show skeleton while loading
  if (isLoading) {
    return <ProfileSkeleton />;
  }

  // Don't render if not authenticated
  if (!user) return null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#faf9f5" }}
    >
      <TopNav />
      <main className="flex-1 max-w-[480px] w-full mx-auto px-5 py-8 flex flex-col gap-5">
        {/* Profile Header */}
        <section
          className="flex items-center gap-4 pb-5 border-b"
          style={{ borderColor: "#dfdedb" }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold"
            style={{ backgroundColor: "#f0efeb", color: "#565552" }}
          >
            {user.email?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-lg font-semibold truncate"
              style={{ color: "#0c0b09" }}
            >
              {user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                "사용자"}
            </p>
            <p className="text-sm truncate" style={{ color: "#908f8c" }}>
              {user.email}
            </p>
          </div>
        </section>

        {/* Stats Section */}
        <section className="flex gap-3">
          <div
            className="flex-1 rounded-xl p-4"
            style={{ backgroundColor: "#f0efeb" }}
          >
            <p
              className="text-xs font-medium mb-1"
              style={{ color: "#908f8c", letterSpacing: "0.02em" }}
            >
              학습 세션
            </p>
            <p className="text-2xl font-bold" style={{ color: "#0c0b09" }}>
              {sessionsCount}
            </p>
          </div>
          <div
            className="flex-1 rounded-xl p-4"
            style={{ backgroundColor: "#f0efeb" }}
          >
            <p
              className="text-xs font-medium mb-1"
              style={{ color: "#908f8c", letterSpacing: "0.02em" }}
            >
              저장한 문장
            </p>
            <p className="text-2xl font-bold" style={{ color: "#0c0b09" }}>
              {savedCount}
            </p>
          </div>
        </section>

        {/* Menu List */}
        <section
          className="rounded-xl overflow-hidden border"
          style={{ backgroundColor: "#ffffff", borderColor: "#dfdedb" }}
        >
          {/* Admin Button - conditionally rendered */}
          {user && <AdminButton userId={user.id} />}

          {/* Subscription Management */}
          <button
            onClick={() => router.push("/pricing")}
            className="w-full flex items-center justify-between px-4 py-4 border-b transition-colors hover:bg-[#faf9f5]"
            style={{ borderColor: "#f0efeb" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#f0efeb" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#72716e"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium" style={{ color: "#0c0b09" }}>
                  구독 관리
                </p>
                <p className="text-xs" style={{ color: "#908f8c" }}>
                  현재 플랜: Free
                </p>
              </div>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#b8b7b4"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-4 transition-colors hover:bg-[#faf9f5]"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#f0efeb" }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#72716e"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: "#565552" }}>
              로그아웃
            </p>
          </button>
        </section>

        {/* Footer Info */}
        <p
          className="text-center text-xs mt-auto pt-4"
          style={{ color: "#b8b7b4" }}
        >
          가입일:{" "}
          {new Date(user.created_at).toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </main>
    </div>
  );
}
