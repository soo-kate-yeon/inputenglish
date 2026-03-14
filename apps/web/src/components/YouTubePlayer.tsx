"use client";

import { useEffect, useRef } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initPlayer = () => {
      if (!containerRef.current) return;

      if (playerRef.current) {
        playerRef.current.destroy();
      }

      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
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
                const time = event.target.getCurrentTime();
                onTimeUpdate(time);
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

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [videoId]);

  return <div ref={containerRef} className={className} />;
}
