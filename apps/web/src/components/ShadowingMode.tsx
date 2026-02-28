'use client';

import { useState, useRef, useEffect } from 'react';
import type { Sentence } from '@shadowoo/shared';
import { playerControls } from './YouTubePlayer';

interface ShadowingModeProps {
    sentences: Sentence[];
    player: YT.Player | null;
}

type ShadowingUnit = 'sentence' | 'paragraph' | 'all';
type ShadowingStage = 'listen' | 'recording' | 'playback';

export default function ShadowingMode({ sentences, player }: ShadowingModeProps) {
    const [unit, setUnit] = useState<ShadowingUnit>('sentence');
    const [stage, setStage] = useState<ShadowingStage>('listen');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [listenCount, setListenCount] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const currentSentence = sentences[currentIndex];

    // Play current sentence
    const playSentence = () => {
        if (!player || !currentSentence) return;

        playerControls.seekTo(player, currentSentence.startTime);
        playerControls.play(player);
        setListenCount(prev => prev + 1);

        // Auto-pause at sentence end
        const duration = (currentSentence.endTime - currentSentence.startTime) * 1000;
        setTimeout(() => {
            playerControls.pause(player);
        }, duration);
    };

    // Start recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);

            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setRecordedBlob(blob);
                setRecordedUrl(URL.createObjectURL(blob));
                setStage('playback');

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setStage('recording');

            // Also play the original
            playSentence();
        } catch (error) {
            console.error('Failed to start recording:', error);
            alert('마이크 권한이 필요합니다');
        }
    };

    // Stop recording
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    // Reset for new recording
    const resetRecording = () => {
        setRecordedBlob(null);
        setRecordedUrl(null);
        setStage('listen');
        setListenCount(0);
    };

    // Navigation
    const goToPrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            resetRecording();
        }
    };

    const goToNext = () => {
        if (currentIndex < sentences.length - 1) {
            setCurrentIndex(prev => prev + 1);
            resetRecording();
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recordedUrl) {
                URL.revokeObjectURL(recordedUrl);
            }
        };
    }, [recordedUrl]);

    if (!currentSentence) {
        return <div className="text-center text-gray-500">문장이 없습니다</div>;
    }

    return (
        <div className="space-y-6">
            {/* Unit Selection */}
            <div className="flex gap-2">
                <button
                    onClick={() => setUnit('sentence')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${unit === 'sentence'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                >
                    1문장씩
                </button>
                <button
                    onClick={() => setUnit('paragraph')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${unit === 'paragraph'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                >
                    1문단씩
                </button>
                <button
                    onClick={() => setUnit('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${unit === 'all'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                >
                    전체
                </button>
            </div>

            {/* Current Sentence Display */}
            <div className="bg-gradient-to-r from-primary-50 to-accent-50 rounded-xl p-6 border border-primary-200">
                <div className="flex items-start gap-3 mb-4">
                    <span className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                        {currentIndex + 1}
                    </span>
                    <p className="text-lg text-gray-900 font-medium">{currentSentence.text}</p>
                </div>

                {/* Listen Count */}
                {listenCount > 0 && stage === 'listen' && (
                    <p className="text-sm text-gray-600">
                        {listenCount}번 들었습니다
                    </p>
                )}
            </div>

            {/* Stage 1: Listen */}
            {stage === 'listen' && (
                <div className="space-y-4">
                    <div className="text-center">
                        <p className="text-gray-600 mb-4">
                            문장을 여러 번 반복해서 들어보세요
                        </p>
                        <button
                            onClick={playSentence}
                            className="px-8 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
                        >
                            🔊 다시 듣기
                        </button>
                    </div>

                    <div className="text-center pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-600 mb-3">
                            준비되셨나요?
                        </p>
                        <button
                            onClick={startRecording}
                            className="px-8 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                        >
                            🎤 쉐도잉 시작
                        </button>
                    </div>
                </div>
            )}

            {/* Stage 2: Recording */}
            {stage === 'recording' && (
                <div className="space-y-4">
                    <div className="bg-red-50 border-2 border-red-500 rounded-xl p-6 text-center">
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                            <p className="text-red-700 font-bold">녹음 중...</p>
                        </div>
                        <p className="text-gray-700 mb-4">
                            원어민의 발음을 따라 말해보세요
                        </p>
                        <button
                            onClick={stopRecording}
                            className="px-8 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                        >
                            ⏹ 녹음 종료
                        </button>
                    </div>
                </div>
            )}

            {/* Stage 3: Playback */}
            {stage === 'playback' && recordedUrl && (
                <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                        <h4 className="font-bold text-gray-900 mb-4">녹음 완료! 🎉</h4>

                        <div className="space-y-3">
                            {/* Original Audio */}
                            <div className="bg-white rounded-lg p-4">
                                <p className="text-sm font-medium text-gray-700 mb-2">원본 재생</p>
                                <button
                                    onClick={playSentence}
                                    className="px-4 py-2 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-200 transition-colors"
                                >
                                    ▶ 원본 듣기
                                </button>
                            </div>

                            {/* Recorded Audio */}
                            <div className="bg-white rounded-lg p-4">
                                <p className="text-sm font-medium text-gray-700 mb-2">내 녹음 재생</p>
                                <audio
                                    src={recordedUrl}
                                    controls
                                    className="w-full"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={resetRecording}
                                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                            >
                                🔄 다시 녹음
                            </button>
                            <button
                                onClick={goToNext}
                                disabled={currentIndex >= sentences.length - 1}
                                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                다음 문장 →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t border-gray-200">
                <button
                    onClick={goToPrevious}
                    disabled={currentIndex === 0}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    ← 이전 문장
                </button>
                <span className="text-sm text-gray-600 flex items-center">
                    {currentIndex + 1} / {sentences.length}
                </span>
                <button
                    onClick={goToNext}
                    disabled={currentIndex >= sentences.length - 1}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    다음 문장 →
                </button>
            </div>
        </div>
    );
}
