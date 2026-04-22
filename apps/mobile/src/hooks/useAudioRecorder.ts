// @MX:NOTE: [AUTO] expo-av based audio recorder hook mirroring web useAudioRecorder interface.
// @MX:SPEC: SPEC-MOBILE-004 - REQ-U-001, REQ-U-005, REQ-E-007, REQ-N-002
import { useState, useRef, useCallback, useEffect } from "react";
import { Alert, Platform } from "react-native";
import { Asset } from "expo-asset";
import { Audio } from "expo-av";
import * as Device from "expo-device";

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
  loadSimulatorSampleRecording: () => Promise<string | null>;
}

const RECORDING_AUDIO_MODE = {
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  interruptionModeIOS: 1 as const,
  interruptionModeAndroid: 1 as const,
  shouldDuckAndroid: true,
  playThroughEarpieceAndroid: false,
};
const PLAYBACK_AUDIO_MODE = {
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  interruptionModeIOS: 1 as const,
  interruptionModeAndroid: 1 as const,
  shouldDuckAndroid: true,
  playThroughEarpieceAndroid: false,
};
const SIMULATOR_SAMPLE_MODULE = require("../../assets/audio/simulator-pronunciation-sample.m4a");
const IOS_WAV_RECORDING_OPTIONS: Audio.RecordingOptions = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  ios: {
    extension: ".wav",
    outputFormat: "lpcm",
    audioQuality: 127,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};
const RECORDING_OPTIONS =
  Platform.OS === "ios"
    ? IOS_WAV_RECORDING_OPTIONS
    : Audio.RecordingOptionsPresets.HIGH_QUALITY;
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
  const simulatorRecordingStartedAtRef = useRef<number | null>(null);

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

  const isSimulatorDevice = !Device.isDevice;

  const getSimulatorSampleUri = useCallback(async (): Promise<string> => {
    const asset = Asset.fromModule(SIMULATOR_SAMPLE_MODULE);
    if (!asset.localUri) {
      await asset.downloadAsync();
    }

    const uri = asset.localUri ?? asset.uri;
    if (!uri) {
      throw new Error("Simulator sample audio is not available");
    }

    return uri;
  }, []);

  const startRecordingAttempt = useCallback(async () => {
    await Audio.setIsEnabledAsync(true);
    await cleanupRecording();
    await cleanupSound();
    await Audio.setAudioModeAsync(RECORDING_AUDIO_MODE);

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
  }, []);

  const getStartRecordingAlertMessage = useCallback(
    (message: string) => {
      if (isSimulatorDevice) {
        return "시뮬레이터에서는 실제 마이크 대신 샘플 음성으로 테스트가 진행돼요.";
      }

      if (
        message.includes("permission") ||
        message.includes("denied") ||
        message.includes("not allowed")
      ) {
        return "마이크 권한이 꺼져 있어요. 설정에서 마이크 접근을 허용한 뒤 다시 시도해주세요.";
      }

      return "녹음을 시작하지 못했어요. 다른 오디오가 재생 중이면 잠시 멈춘 뒤 다시 시도해주세요.";
    },
    [isSimulatorDevice],
  );

  const startRecording = useCallback(async () => {
    if (operationInFlightRef.current || recordingState === "recording") {
      return false;
    }

    if (isSimulatorDevice) {
      operationInFlightRef.current = true;
      setIsRecorderBusy(true);
      setLastError(null);

      try {
        await cleanupRecording();
        await cleanupSound();
        await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE);

        simulatorRecordingStartedAtRef.current = Date.now();
        setDuration(0);
        setRecordingState("recording");
        setAudioUri(null);
        setPlaybackProgress(0);
        return true;
      } catch (error) {
        console.error("Failed to start simulator sample recording:", error);
        const message =
          error instanceof Error ? error.message : "Unknown simulator error";
        setLastError(message);
        Alert.alert(
          "샘플 녹음을 시작할 수 없어요",
          "시뮬레이터용 샘플 음성을 불러오지 못했어요. 앱을 다시 실행한 뒤 한 번 더 시도해주세요.",
        );
        return false;
      } finally {
        operationInFlightRef.current = false;
        setIsRecorderBusy(false);
      }
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
      try {
        await startRecordingAttempt();
      } catch (firstError) {
        console.warn(
          "[useAudioRecorder] First recording attempt failed, retrying once:",
          firstError,
        );
        await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE).catch(() => {
          // Ignore recovery failures between attempts.
        });
        await new Promise((resolve) => setTimeout(resolve, 180));
        await startRecordingAttempt();
      }

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
      await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE).catch(() => {
        // Ignore audio mode cleanup failures.
      });
      Alert.alert(
        "녹음을 시작할 수 없어요",
        getStartRecordingAlertMessage(message),
      );
      return false;
    } finally {
      operationInFlightRef.current = false;
      setIsRecorderBusy(false);
    }
  }, [
    getStartRecordingAlertMessage,
    hasPermission,
    isSimulatorDevice,
    requestPermission,
    startRecordingAttempt,
  ]);

  const stopRecording = useCallback(async () => {
    if (operationInFlightRef.current) {
      return null;
    }

    if (isSimulatorDevice && recordingState === "recording") {
      operationInFlightRef.current = true;
      setIsRecorderBusy(true);
      setLastError(null);

      try {
        const uri = await getSimulatorSampleUri();
        const startedAt = simulatorRecordingStartedAtRef.current;
        const elapsedSeconds = startedAt
          ? Math.max(1, Math.round((Date.now() - startedAt) / 1000))
          : 1;

        simulatorRecordingStartedAtRef.current = null;
        await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE);

        setAudioUri(uri);
        setDuration(elapsedSeconds);
        setRecordingState("playback");
        setIsPlaying(false);
        setPlaybackProgress(0);
        return uri;
      } catch (error) {
        console.error("Failed to stop simulator sample recording:", error);
        const message =
          error instanceof Error ? error.message : "Unknown simulator error";
        setLastError(message);
        return null;
      } finally {
        operationInFlightRef.current = false;
        setIsRecorderBusy(false);
      }
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

      await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE);

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
  }, [getSimulatorSampleUri, isSimulatorDevice, recordingState]);

  const loadSimulatorSampleRecording = useCallback(async () => {
    if (!isSimulatorDevice || operationInFlightRef.current) {
      return null;
    }

    operationInFlightRef.current = true;
    setIsRecorderBusy(true);
    setLastError(null);

    try {
      await cleanupRecording();
      await cleanupSound();
      const uri = await getSimulatorSampleUri();
      await Audio.setAudioModeAsync(PLAYBACK_AUDIO_MODE);

      simulatorRecordingStartedAtRef.current = null;
      setAudioUri(uri);
      setDuration(4);
      setRecordingState("playback");
      setIsPlaying(false);
      setPlaybackProgress(0);
      return uri;
    } catch (error) {
      console.error("Failed to load simulator sample recording:", error);
      const message =
        error instanceof Error ? error.message : "Unknown simulator error";
      setLastError(message);
      return null;
    } finally {
      operationInFlightRef.current = false;
      setIsRecorderBusy(false);
    }
  }, [getSimulatorSampleUri, isSimulatorDevice]);

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
      simulatorRecordingStartedAtRef.current = null;

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
    loadSimulatorSampleRecording,
  };
}
