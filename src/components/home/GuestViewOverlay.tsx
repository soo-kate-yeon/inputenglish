"use client";

import { useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";

export default function GuestViewOverlay() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <>
      {/* Bottom Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none">
        <div className="max-w-[1920px] mx-auto px-8 pb-8">
          <div
            className="bg-gradient-to-r from-primary-500/95 to-orange-500/95 backdrop-blur-md rounded-xl p-6 flex items-center justify-between gap-6 pointer-events-auto border-border-default"
            style={{
              borderWidth: "var(--border-width-strong)",
              borderStyle: "solid",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-white shrink-0"
                style={{
                  borderWidth: "var(--border-width-default)",
                  borderStyle: "solid",
                  borderColor: "rgba(255, 255, 255, 0.3)",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              </div>
              <div className="text-white">
                <p className="font-bold text-lg leading-tight">
                  이런 영상들로 학습하고 싶으세요?
                </p>
                <p className="text-white/90 text-sm">
                  회원가입하고 모든 기능을 이용해보세요
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-white font-bold py-3 px-8 rounded-xl hover:bg-white/90 transition-all active:scale-95 whitespace-nowrap text-text-brand"
              style={{
                borderWidth: "var(--border-width-default)",
                borderStyle: "solid",
                borderColor: "var(--color-border-default)",
              }}
            >
              회원가입하고 시작하기 →
            </button>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultMode="signup"
      />
    </>
  );
}
