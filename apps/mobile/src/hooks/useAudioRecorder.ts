// @MX:NOTE: [AUTO] expo-av based audio recorder hook mirroring web useAudioRecorder interface.
// @MX:SPEC: SPEC-MOBILE-004 - REQ-U-001, REQ-U-005, REQ-E-007, REQ-N-002
import { useState, useRef, useCallback, useEffect } from "react";
import { Alert, Platform } from "react-native";
import { Audio } from "expo-av";

export type RecordingState = "idle" | "recording" | "playback";

export interface UseAudioRecorderReturn {
  recordingState: RecordingState;
  audioUri: string | null;
  duration: number; // seconds
  isPlaying: boolean;
  playbackProgress: number; // 0-1
  hasPermission: boolean | null;
  isRecorderBusy: boolean;
  lastError: string | null;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<string | null>;
  playRecording: () => Promise<void>;
  pauseRecording: () => void;
  resetRecording: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
}

const RECORDING_OPTIONS = Audio.RecordingOptionsPresets.HIGH_QUALITY;

export default function useAudioRecorder(): UseAudioRecorderReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isRecorderBusy, setIsRecorderBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const operationInFlightRef = useRef(false);

  // Check permission on mount
  useEffect(() => {
    Audio.getPermissionsAsync().then((status) => {
      setHasPermission(status.granted);
    });
    return () => {
      // Cleanup on unmount
      void cleanupRecording();
      void cleanupSound();
    };
  }, []);

  const cleanupRecording = async () => {
    if (recordingRef.current) {
      try {
        const status = await recordingRef.current.getStatusAsync();
        if (status.isRecording || status.canRecord) {
          await recordingRef.current.stopAndUnloadAsync();
        } else {
          await recordingRef.current.stopAndUnloadAsync().catch(() => {
            // Ignore stop failures for partially prepared recorders.
          });
        }
      } catch {
        // Ignore cleanup errors
      }
      recordingRef.current = null;
    }
  };

  const cleanupSound = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {
        // Ignore cleanup errors
      }
      soundRef.current = null;
    }
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const status = await Audio.requestPermissionsAsync();
    setHasPermission(status.granted);
    return status.granted;
  }, []);

  const startRecording = useCallback(async () => {
    if (operationInFlightRef.current || recordingState === "recording") {
      return false;
    }

    // Check or request permission (handle null initial state)
    let permitted = hasPermission;
    if (permitted === null || !permitted) {
      permitted = await requestPermission();
    }
    if (!permitted) {
      Alert.alert(
        "마이크 권한 필요",
        "쉐도잉 녹음을 위해 마이크 권한이 필요합니다. 설정에서 권한을 허용해주세요.",
      );
      return false;
    }

    operationInFlightRef.current = true;
    setIsRecorderBusy(true);
    setLastError(null);

    try {
      await cleanupRecording();
      await cleanupSound();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const recording = new Audio.Recording();
      recording.setOnRecordingStatusUpdate((status) => {
        if (!("canRecord" in status) || !status.canRecord) return;
        const durationMillis = status.durationMillis ?? 0;
        setDuration(Math.floor(durationMillis / 1000));
      });
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      const status = await recording.getStatusAsync();

      if (!status.canRecord) {
        throw new Error("Recorder was not prepared correctly");
      }

      await recording.startAsync();
      recordingRef.current = recording;

      setDuration(0);
      setRecordingState("recording");
      setAudioUri(null);
      setPlaybackProgress(0);
      return true;
    } catch (error) {
      console.error("Failed to start recording:", error);
      const message =
        error instanceof Error ? error.message : "Unknown recording error";
      setLastError(message);
      recordingRef.current = null;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      }).catch(() => {
        // Ignore audio mode cleanup failures.
      });
      if (Platform.OS === "ios") {
        Alert.alert(
          "녹음을 시작할 수 없어요",
          "iOS 시뮬레이터에서는 오디오 녹음이 지원되지 않습니다. 실제 iPhone 기기에서 테스트해주세요.",
        );
      }
      return false;
    } finally {
      operationInFlightRef.current = false;
      setIsRecorderBusy(false);
    }
  }, [hasPermission, requestPermission]);

  const stopRecording = useCallback(async () => {
    if (operationInFlightRef.current) {
      return null;
    }

    if (!recordingRef.current) return null;

    operationInFlightRef.current = true;
    setIsRecorderBusy(true);
    setLastError(null);

    try {
      const currentRecording = recordingRef.current;
      recordingRef.current = null;
      await currentRecording.stopAndUnloadAsync();
      const uri = currentRecording.getURI();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      setAudioUri(uri);
      setRecordingState("playback");
      setIsPlaying(false);
      setPlaybackProgress(0);
      return uri ?? null;
    } catch (error) {
      console.error("Failed to stop recording:", error);
      const message =
        error instanceof Error ? error.message : "Unknown recording error";
      setLastError(message);
      return null;
    } finally {
      operationInFlightRef.current = false;
      setIsRecorderBusy(false);
    }
  }, []);

  const playRecording = useCallback(async () => {
    if (!audioUri) return;

    try {
      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
        soundRef.current = sound;

        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          const durationMs = status.durationMillis ?? 0;
          const positionMs = status.positionMillis ?? 0;
          if (durationMs > 0) {
            setPlaybackProgress(positionMs / durationMs);
          }
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPlaybackProgress(0);
          }
        });
      } else {
        // Sound already loaded (e.g. replaying after finish) — reset to start
        await soundRef.current.setPositionAsync(0);
      }

      await soundRef.current.playAsync();
      setIsPlaying(true);
    } catch (error) {
      console.error("Failed to play recording:", error);
    }
  }, [audioUri]);

  const pauseRecording = useCallback(() => {
    if (!soundRef.current) return;
    soundRef.current
      .pauseAsync()
      .then(() => {
        setIsPlaying(false);
      })
      .catch((error) => {
        console.error("Failed to pause:", error);
      });
  }, []);

  const resetRecording = useCallback(async () => {
    if (operationInFlightRef.current) {
      return;
    }
    operationInFlightRef.current = true;
    setIsRecorderBusy(true);
    try {
      await cleanupRecording();
      await cleanupSound();

      setRecordingState("idle");
      setAudioUri(null);
      setDuration(0);
      setIsPlaying(false);
      setPlaybackProgress(0);
      setLastError(null);
    } finally {
      operationInFlightRef.current = false;
      setIsRecorderBusy(false);
    }
  }, []);

  return {
    recordingState,
    audioUri,
    duration,
    isPlaying,
    playbackProgress,
    hasPermission,
    isRecorderBusy,
    lastError,
    startRecording,
    stopRecording,
    playRecording,
    pauseRecording,
    resetRecording,
    requestPermission,
  };
}
