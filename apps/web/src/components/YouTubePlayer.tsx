"use client";

import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  className?: string;
  onReady?: (player: YT.Player) => void;
  onTimeUpdate?: (time: number) => void;
  showNativeControls?: boolean;
}

export default function YouTubePlayer({
  videoId,
  className,
  onReady,
  onTimeUpdate,
  showNativeControls = true,
}: YouTubePlayerProps) {
  // Wrapper div is managed by React; inner target div is created imperatively
  // so React never tries to removeChild on a node YouTube replaced with <iframe>
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const destroyPlayer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch {
        // Player may already be destroyed
      }
      playerRef.current = null;
    }
    // Clear any leftover DOM from YouTube's iframe replacement
    if (wrapperRef.current) {
      wrapperRef.current.innerHTML = "";
    }
  }, []);

  useEffect(() => {
    const initPlayer = () => {
      if (!wrapperRef.current) return;

      // Clean up previous player and DOM
      destroyPlayer();

      // Create a fresh target div for YT.Player (not tracked by React)
      const targetEl = document.createElement("div");
      targetEl.style.width = "100%";
      targetEl.style.height = "100%";
      wrapperRef.current.appendChild(targetEl);

      playerRef.current = new YT.Player(targetEl, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          controls: showNativeControls ? 1 : 0,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event) => {
            onReady?.(event.target);
            if (onTimeUpdate) {
              intervalRef.current = setInterval(() => {
                try {
                  const time = event.target.getCurrentTime();
                  onTimeUpdate(time);
                } catch {
                  // Player may have been destroyed
                  if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                  }
                }
              }, 100);
            }
          },
        },
      });
    };

    if (typeof window !== "undefined") {
      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        const prevCallback = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          prevCallback?.();
          initPlayer();
        };
      }
    }

    return destroyPlayer;
  }, [videoId]);

  return <div ref={wrapperRef} className={className} />;
}
