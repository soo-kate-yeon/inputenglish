// @MX:NOTE: [AUTO] KR->EN translation exercise page with recording (SPEC-MOBILE-011).
import React, { useCallback, useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { TransformationExercise } from "@inputenglish/shared";
import useAudioRecorder from "../../../hooks/useAudioRecorder";
import { ExerciseRecordingBar } from "./ExerciseRecordingBar";
import { colors, font, leading, radius, spacing } from "../../../theme";

interface KoreanToEnglishPageProps {
  exercise: TransformationExercise;
  onConfirm: (audioUri: string | null, duration: number) => void;
  onRecordingStateChange?: (recording: boolean) => void;
}

export function KoreanToEnglishPage({
  exercise,
  onConfirm,
  onRecordingStateChange,
}: KoreanToEnglishPageProps) {
  const {
    recordingState,
    audioUri,
    duration,
    isPlaying,
    playbackProgress,
    startRecording,
    stopRecording,
    playRecording,
    pauseRecording,
    resetRecording,
  } = useAudioRecorder();

  useEffect(() => {
    onRecordingStateChange?.(recordingState !== "idle");
  }, [recordingState, onRecordingStateChange]);

  const handleConfirm = useCallback(() => {
    onConfirm(audioUri, duration);
  }, [audioUri, duration, onConfirm]);

  const hasPlayedRef = useRef(false);
  useEffect(() => {
    if (isPlaying) {
      hasPlayedRef.current = true;
    } else if (
      hasPlayedRef.current &&
      playbackProgress === 0 &&
      recordingState === "playback"
    ) {
      hasPlayedRef.current = false;
      handleConfirm();
    }
  }, [isPlaying, playbackProgress, recordingState, handleConfirm]);

  const handleStop = useCallback(async () => {
    await stopRecording();
  }, [stopRecording]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>KR → EN</Text>
        <Text style={styles.instruction}>{exercise.instruction_text}</Text>
        {exercise.source_korean != null && (
          <View style={styles.promptBox}>
            <Text style={styles.promptText}>{exercise.source_korean}</Text>
          </View>
        )}
      </ScrollView>

      <ExerciseRecordingBar
        recordingState={recordingState}
        duration={duration}
        isPlaying={isPlaying}
        playbackProgress={playbackProgress}
        onStart={startRecording}
        onStop={handleStop}
        onPlay={playRecording}
        onPause={pauseRecording}
        onReRecord={resetRecording}
        onConfirm={handleConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 96,
    gap: spacing.lg,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: font.weight.bold,
    letterSpacing: 1.5,
    color: colors.textMuted,
  },
  instruction: {
    fontSize: font.size.base,
    lineHeight: leading(font.size.base, font.lineHeight.relaxed),
    color: colors.textSecondary,
    letterSpacing: font.tracking.normal,
  },
  promptBox: {
    backgroundColor: colors.bgMuted,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  promptText: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.text,
    lineHeight: leading(font.size.xl, font.lineHeight.relaxed),
    letterSpacing: font.tracking.semiTight,
  },
});
