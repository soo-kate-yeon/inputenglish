// Audio recording hook using MediaRecorder API
import { useState, useRef, useCallback } from 'react';

export type RecordingState = 'idle' | 'recording' | 'playback';

interface UseAudioRecorderReturn {
    recordingState: RecordingState;
    audioUrl: string | null;
    duration: number;
    isPlaying: boolean;
    playbackProgress: number;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    playRecording: () => Promise<void>;
    pauseRecording: () => void;
    resetRecording: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
    const [recordingState, setRecordingState] = useState<RecordingState>('idle');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackProgress, setPlaybackProgress] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const startTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number | null>(null);

    const startRecording = useCallback(async () => {
        try {
            // 기존 재생/녹음 정리
            if (audioElementRef.current) {
                audioElementRef.current.pause();
                audioElementRef.current.ontimeupdate = null;
                audioElementRef.current.onended = null;
                audioElementRef.current = null;
            }
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }

            // 상태 초기화
            setIsPlaying(false);
            setPlaybackProgress(0);

            // Request microphone permission with quality constraints
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,
                    channelCount: 1
                }
            });

            // Determine supported mime type with proper fallback chain
            const getSupportedMimeType = () => {
                const types = [
                    'audio/webm;codecs=opus',
                    'audio/webm',
                    'audio/ogg;codecs=opus',
                    'audio/mp4;codecs=aac'
                ];
                return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
            };
            const mimeType = getSupportedMimeType();

            // Create MediaRecorder
            const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                const url = URL.createObjectURL(audioBlob);
                setAudioUrl(url);
                setRecordingState('playback');

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            // Start recording
            mediaRecorder.start();
            startTimeRef.current = Date.now();
            setRecordingState('recording');
            setDuration(0);

            // Update duration while recording
            const updateDuration = () => {
                if (mediaRecorderRef.current?.state === 'recording') {
                    const elapsed = (Date.now() - startTimeRef.current) / 1000;
                    setDuration(elapsed);
                    animationFrameRef.current = requestAnimationFrame(updateDuration);
                }
            };
            updateDuration();

        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('마이크 접근 권한이 필요합니다. 브라우저 설정에서 마이크 권한을 허용해주세요.');
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    }, []);

    const playRecording = useCallback(async () => {
        if (!audioUrl) return;

        // 새 Audio 객체 생성
        if (!audioElementRef.current) {
            const audio = new Audio(audioUrl);
            audioElementRef.current = audio;

            // metadata 로드 완료 대기
            await new Promise<void>((resolve) => {
                audio.onloadedmetadata = () => {
                    setDuration(audio.duration);
                    resolve();
                };
                // 이미 로드된 경우 처리
                if (audio.readyState >= 1) {
                    setDuration(audio.duration);
                    resolve();
                }
            });

            // timeupdate 이벤트로 progress 업데이트 (더 안정적)
            audio.ontimeupdate = () => {
                if (isFinite(audio.duration) && audio.duration > 0) {
                    const progress = (audio.currentTime / audio.duration) * 100;
                    setPlaybackProgress(progress);
                }
            };

            audio.onended = () => {
                setIsPlaying(false);
                setPlaybackProgress(0);
            };
        }

        // 재생
        try {
            await audioElementRef.current.play();
            setIsPlaying(true);
        } catch (e) {
            console.error("Playback failed", e);
        }
    }, [audioUrl]);

    const pauseRecording = useCallback(() => {
        if (audioElementRef.current) {
            audioElementRef.current.pause();
            setIsPlaying(false);
        }
    }, []);

    const resetRecording = useCallback(() => {
        // Stop audio playback and cleanup
        if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current.ontimeupdate = null;
            audioElementRef.current.onended = null;
            audioElementRef.current = null;
        }

        // Stop recording if active
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }

        // Cancel any running animation frames (for recording duration)
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
        setAudioUrl(null);
        setRecordingState('idle');
        setIsPlaying(false);
        setDuration(0);
        setPlaybackProgress(0);
        audioChunksRef.current = [];
    }, [audioUrl]);

    return {
        recordingState,
        audioUrl,
        duration,
        isPlaying,
        playbackProgress,
        startRecording,
        stopRecording,
        playRecording,
        pauseRecording,
        resetRecording
    };
}
