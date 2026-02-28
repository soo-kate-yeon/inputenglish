"use client";

import { Play, Pause, Square, Globe, Bookmark, X, Check, Mic } from "lucide-react";

type RecordingState = 'idle' | 'recording' | 'playback';

interface RecordingBarProps {
    state: RecordingState;
    onRecord: () => void;
    onStop: () => void;
    onPlay: () => void;
    onPause: () => void;
    onCancel?: () => void;
    onDone?: () => void;
    isPlaying?: boolean;
    recordingDuration?: number;
    playbackProgress?: number;
}

export function RecordingBar({
    state,
    onRecord,
    onStop,
    onPlay,
    onPause,
    onCancel,
    onDone,
    isPlaying = false,
    recordingDuration = 0,
    playbackProgress = 0
}: RecordingBarProps) {
    const formatTime = (seconds: number) => {
        if (!isFinite(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const currentTime = isFinite(playbackProgress) && isFinite(recordingDuration)
        ? (playbackProgress / 100) * recordingDuration
        : 0;

    if (state === 'idle') {
        return null; // Hidden when idle
    }

    return (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 flex items-center justify-center w-full px-4">
            <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-full pl-2 pr-6 py-2 flex items-center gap-6 shadow-2xl min-w-[500px] max-w-3xl ring-1 ring-white/5">

                {/* Left Control Button */}
                <div className="shrink-0">
                    {state === 'recording' ? (
                        <button
                            onClick={onStop}
                            className="w-12 h-12 rounded-full bg-error/90 hover:bg-error flex items-center justify-center transition-colors group"
                            aria-label="녹음 중지"
                        >
                            <Square className="w-5 h-5 text-white fill-white group-hover:scale-90 transition-transform" />
                        </button>
                    ) : (
                        <button
                            onClick={isPlaying ? onPause : onPlay}
                            className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors group"
                            aria-label={isPlaying ? "일시정지" : "재생"}
                        >
                            {isPlaying ? (
                                <Pause className="w-5 h-5 text-white fill-white" />
                            ) : (
                                <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                            )}
                        </button>
                    )}
                </div>

                {/* Center Content */}
                <div className="flex-1 flex items-center gap-6 min-w-0">
                    {state === 'recording' ? (
                        /* Recording Status */
                        <div className="flex items-center justify-center gap-3 flex-1">
                            <div className="w-2.5 h-2.5 bg-error rounded-full animate-pulse" />
                            <span className="text-white font-medium whitespace-nowrap text-lg">
                                녹음 중... {formatTime(recordingDuration)}
                            </span>
                        </div>
                    ) : (
                        /* Playback Progress */
                        <div className="flex flex-col justify-center flex-1 gap-1.5">
                            <div className="flex items-center justify-between text-xs font-medium px-1">
                                <span className="text-white/80">{formatTime(currentTime)}</span>
                                <span className="text-white/80">{formatTime(recordingDuration)}</span>
                            </div>
                            <div className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer group">
                                <div
                                    className="absolute inset-y-0 left-0 bg-primary-500 rounded-full group-hover:bg-primary-400"
                                    style={{ width: `${playbackProgress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-3 pl-4 border-l border-white/10 shrink-0">
                    {state !== 'playback' && (
                        <button
                            onClick={onCancel}
                            className="text-white/70 hover:text-white/90 text-sm font-medium transition-colors px-2"
                        >
                            취소
                        </button>
                    )}

                    {state === 'playback' && (
                        <button
                            onClick={onRecord}
                            className="text-white/70 hover:text-white text-sm font-medium transition-colors flex items-center gap-1.5 px-2"
                        >
                            <Mic className="w-4 h-4" />
                            다시 녹음
                        </button>
                    )}

                    <button
                        onClick={onDone}
                        className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2 rounded-full text-sm font-bold transition-colors shadow-lg shadow-primary-500/20"
                    >
                        완료
                    </button>
                </div>
            </div>
        </div>
    );
}
