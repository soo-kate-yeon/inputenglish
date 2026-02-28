'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@shadowoo/shared';

interface YouTubePlayerProps {
    videoId: string;
    onReady?: (player: YT.Player) => void;
    onTimeUpdate?: (currentTime: number) => void;
    onPlayingStateChange?: (isPlaying: boolean) => void;
    disableSpacebarControl?: boolean;
    startSeconds?: number; // Start time for snippet playback
    endSeconds?: number;   // End time for snippet playback
    showNativeControls?: boolean; // Show native YouTube controls
    className?: string;
}

declare global {
    interface Window {
        YT: typeof YT;
        onYouTubeIframeAPIReady: () => void;
    }
}

// Exported controls to interact with the player from parent components
export const playerControls = {
    play: (player: YT.Player) => player.playVideo(),
    pause: (player: YT.Player) => player.pauseVideo(),
    seekTo: (player: YT.Player, seconds: number) => player.seekTo(seconds, true),
};

// Custom Icons matching the context design
function ClockIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F9F7F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C13.94 2 15.84 2.56 17.46 3.62C19.09 4.68 20.37 6.19 21.15 7.97C21.94 9.74 22.18 11.71 21.87 13.62C21.55 15.54 20.69 17.32 19.38 18.75M12 6V12L16 14M2.5 8.88C2.18 9.84 2.01 10.86 2 11.88M2.83 16C3.39 17.29 4.22 18.45 5.26 19.4M4.64 5.24C4.92 4.93 5.21 4.65 5.53 4.38M8.64 21.42C11.14 22.31 13.88 22.17 16.28 21.04" />
        </svg>
    );
}

function VolumeIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F9F7F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 9C16.65 9.87 17 10.92 17 12C17 13.08 16.65 14.13 16 15M19.36 18.36C20.2 17.53 20.86 16.54 21.32 15.44C21.77 14.35 22 13.18 22 12C22 10.82 21.77 9.65 21.32 8.56C20.86 7.46 20.2 6.47 19.36 5.64M11 4.7C11 4.56 10.96 4.43 10.88 4.31C10.8 4.2 10.69 4.1 10.56 4.05C10.44 4 10.29 3.98 10.16 4.01C10.02 4.04 9.9 4.11 9.8 4.2L6.41 7.59C6.28 7.72 6.13 7.82 5.96 7.89C5.78 7.96 5.6 8 5.42 8H3C2.73 8 2.48 8.11 2.29 8.29C2.11 8.48 2 8.73 2 9V15C2 15.27 2.11 15.52 2.29 15.71C2.48 15.89 2.73 16 3 16H5.42C5.6 16 5.78 16.04 5.96 16.11C6.13 16.18 6.28 16.28 6.41 16.41L9.8 19.8C9.9 19.9 10.02 19.96 10.16 19.99C10.29 20.02 10.44 20 10.56 19.95C10.69 19.9 10.8 19.81 10.88 19.69C10.96 19.57 11 19.44 11 19.3V4.7Z" />
        </svg>
    );
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function YouTubePlayer({
    videoId,
    onReady,
    onTimeUpdate,
    onPlayingStateChange,
    disableSpacebarControl = false,
    startSeconds = 0,
    endSeconds,
    showNativeControls = false,
    className = '',
}: YouTubePlayerProps) {
    const playerRef = useRef<YT.Player | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [isAPIReady, setIsAPIReady] = useState(false);

    // Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(100);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showControls, setShowControls] = useState(false);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);

    // Load YouTube IFrame API
    useEffect(() => {
        if (window.YT && window.YT.Player) {
            setIsAPIReady(true);
            return;
        }

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
            setIsAPIReady(true);
        };
    }, []);

    // Initialize player
    useEffect(() => {
        if (!isAPIReady || !containerRef.current) return;

        playerRef.current = new window.YT.Player(containerRef.current, {
            videoId,
            playerVars: {
                autoplay: 0,
                controls: showNativeControls ? 1 : 0, // Toggle default controls
                modestbranding: 1,
                rel: 0,
                disablekb: 1, // Disable default keyboard controls
                fs: 0, // Hide fullscreen button
                start: startSeconds, // Start at snippet start time
            },
            events: {
                onReady: (event) => {
                    setDuration(endSeconds || event.target.getDuration());
                    setVolume(event.target.getVolume());
                    onReady?.(event.target);
                },
                onStateChange: (event) => {
                    const playing = event.data === window.YT.PlayerState.PLAYING;
                    setIsPlaying(playing);
                    onPlayingStateChange?.(playing);
                    if (playing) {
                        startTimeUpdateInterval();
                    }
                },
            },
        });

        return () => {
            playerRef.current?.destroy();
        };
    }, [isAPIReady, videoId, startSeconds, endSeconds, onPlayingStateChange]);

    // Time update interval
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeUpdateInterval = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
            if (playerRef.current && playerRef.current.getPlayerState() === window.YT.PlayerState.PLAYING) {
                const time = playerRef.current.getCurrentTime();

                // Loop back to start if we've reached the end of snippet
                if (endSeconds && time >= endSeconds) {
                    playerRef.current.seekTo(startSeconds, true);
                    return;
                }

                setCurrentTime(time);
                onTimeUpdate?.(time);
            } else {
                if (intervalRef.current) clearInterval(intervalRef.current);
            }
        }, 100);
    }, [onTimeUpdate, startSeconds, endSeconds]);

    // Cleanup interval
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // Keyboard listener for spacebar
    useEffect(() => {
        if (disableSpacebarControl) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle spacebar if the wrapper is focused or if no input is focused
            if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                // Use playerRef to get current state instead of stale isPlaying
                if (playerRef.current) {
                    const currentState = playerRef.current.getPlayerState();
                    if (currentState === window.YT.PlayerState.PLAYING) {
                        playerRef.current.pauseVideo();
                    } else {
                        playerRef.current.playVideo();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [disableSpacebarControl]);

    // Controls Handlers
    const togglePlay = () => {
        if (!playerRef.current) return;
        if (isPlaying) {
            playerRef.current.pauseVideo();
        } else {
            playerRef.current.playVideo();
        }
    };

    const toggleMute = () => {
        if (!playerRef.current) return;
        if (isMuted) {
            playerRef.current.unMute();
            playerRef.current.setVolume(volume);
            setIsMuted(false);
        } else {
            playerRef.current.mute();
            setIsMuted(true);
        }
    };

    const handleSpeedChange = (speed: number) => {
        if (!playerRef.current) return;
        playerRef.current.setPlaybackRate(speed);
        setPlaybackRate(speed);
        setShowSpeedMenu(false);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleVideoClick = (e: React.MouseEvent) => {
        // Prevent click if clicking on controls
        if ((e.target as HTMLElement).closest('.controls-area')) {
            return;
        }
        togglePlay();
    };

    return (
        <div
            ref={wrapperRef}
            className={`relative group ${className}`}
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => {
                setShowControls(false);
                setShowSpeedMenu(false);
            }}
            tabIndex={0} // Make focusable for keyboard events
        >
            {/* Video Container */}
            <div
                className="relative aspect-video w-full bg-black rounded-2xl overflow-hidden cursor-pointer"
                onClick={handleVideoClick}
            >
                <div ref={containerRef} className="absolute inset-0 w-full h-full" />
            </div>

            {/* Custom Controls Overlay */}
            {!showNativeControls && (
                <div
                    className={cn(
                        "absolute inset-0 flex flex-col justify-end p-6 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300 rounded-2xl pointer-events-none",
                        showControls || !isPlaying ? "opacity-100" : "opacity-0"
                    )}
                >
                    <div className="flex items-center gap-3 controls-area pointer-events-auto">
                        {/* Time */}
                        <div className="bg-black/30 backdrop-blur-md px-3 py-2 rounded-full flex items-center gap-2 border border-secondary-500/30">
                            <span className="text-secondary-50 text-body-large font-medium">{formatTime(currentTime)}</span>
                            <span className="text-secondary-50/50 text-body-large font-medium">/ {formatTime(duration)}</span>
                        </div>

                        {/* Volume */}
                        <button
                            onClick={toggleMute}
                            className="bg-black/30 backdrop-blur-md px-4 py-2 rounded-full flex items-center border border-secondary-500/30 hover:bg-black/40 cursor-pointer transition-colors"
                        >
                            {isMuted ? <VolumeX className="w-6 h-6 text-secondary-50" /> : <VolumeIcon />}
                        </button>

                        {/* Speed */}
                        <div className="relative ml-auto">
                            <button
                                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                                className="bg-black/30 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-1 border border-secondary-500/30 hover:bg-black/40 cursor-pointer transition-colors"
                            >
                                <ClockIcon />
                                <span className="text-secondary-50 text-body-large font-medium">{playbackRate}배</span>
                            </button>

                            {showSpeedMenu && (
                                <div className="absolute bottom-full mb-2 right-0 bg-black/90 backdrop-blur-md rounded-lg p-2 min-w-[80px] flex flex-col gap-1">
                                    {PLAYBACK_SPEEDS.map((speed) => (
                                        <button
                                            key={speed}
                                            onClick={() => handleSpeedChange(speed)}
                                            className={cn(
                                                "px-3 py-2 text-sm rounded-lg hover:bg-white/20 transition-colors text-left",
                                                playbackRate === speed ? "text-primary-500 font-bold bg-white/10" : "text-white"
                                            )}
                                        >
                                            {speed}배
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
