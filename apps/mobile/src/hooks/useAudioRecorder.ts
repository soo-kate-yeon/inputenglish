// @MX:NOTE: [AUTO] expo-av based audio recorder hook mirroring web useAudioRecorder interface.
// @MX:SPEC: SPEC-MOBILE-004 - REQ-U-001, REQ-U-005, REQ-E-007, REQ-N-002
import { useState, useRef, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import { Audio } from "expo-av";

export type RecordingState = "idle" | "recording" | "playback";

export interface UseAudioRecorderReturn {
  recordingState: RecordingState;
  audioUri: string | null;
  duration: number; // seconds
  isPlaying: boolean;
  playbackProgress: number; // 0-1
  hasPermission: boolean | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  playRecording: () => Promise<void>;
  pauseRecording: () => void;
  resetRecording: () => void;
  requestPermission: () => Promise<boolean>;
}

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: ".m4a",
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: ".m4a",
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
  },
  web: {},
};

export default function useAudioRecorder(): UseAudioRecorderReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const durationRef = useRef(0);

  // Check permission on mount
  useEffect(() => {
    Audio.getPermissionsAsync().then((status) => {
      setHasPermission(status.granted);
    });
    return () => {
      // Cleanup on unmount
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      void cleanupRecording();
      void cleanupSound();
    };
  }, []);

  const cleanupRecording = async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
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
    // Check or request permission
    let permitted = hasPermission;
    if (!permitted) {
      permitted = await requestPermission();
    }
    if (!permitted) {
      Alert.alert(
        "마이크 권한 필요",
        "쉐도잉 녹음을 위해 마이크 권한이 필요합니다. 설정에서 권한을 허용해주세요.",
      );
      return;
    }

    try {
      await cleanupRecording();
      await cleanupSound();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.startAsync();
      recordingRef.current = recording;

      // Track duration with 100ms interval
      durationRef.current = 0;
      setDuration(0);
      durationIntervalRef.current = setInterval(() => {
        durationRef.current += 0.1;
        setDuration(Math.floor(durationRef.current));
      }, 100);

      setRecordingState("recording");
      setAudioUri(null);
      setPlaybackProgress(0);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }, [hasPermission, requestPermission]);

  const stopRecording = useCallback(async () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      setAudioUri(uri);
      setRecordingState("playback");
      setIsPlaying(false);
      setPlaybackProgress(0);
    } catch (error) {
      console.error("Failed to stop recording:", error);
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

  const resetRecording = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    void cleanupRecording();
    void cleanupSound();

    setRecordingState("idle");
    setAudioUri(null);
    setDuration(0);
    setIsPlaying(false);
    setPlaybackProgress(0);
    durationRef.current = 0;
  }, []);

  return {
    recordingState,
    audioUri,
    duration,
    isPlaying,
    playbackProgress,
    hasPermission,
    startRecording,
    stopRecording,
    playRecording,
    pauseRecording,
    resetRecording,
    requestPermission,
  };
}
