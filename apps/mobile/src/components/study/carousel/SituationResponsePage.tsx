// @MX:NOTE: [AUTO] Situation-response exercise page (v2, SPEC-MOBILE-011).
// Shows a situation description; user records their spontaneous English response.
import React, { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TransformationExercise } from "@inputenglish/shared";
import useAudioRecorder from "../../../hooks/useAudioRecorder";
import { ExerciseRecordingBar } from "./ExerciseRecordingBar";
import { colors, font, spacing } from "../../../theme";

interface SituationResponsePageProps {
  exercise: TransformationExercise;
  onConfirm: (audioUri: string | null, duration: number) => void;
}

export function SituationResponsePage({
  exercise,
  onConfirm,
}: SituationResponsePageProps) {
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

  const handleConfirm = useCallback(() => {
    onConfirm(audioUri, duration);
  }, [audioUri, duration, onConfirm]);

  const handleStop = useCallback(async () => {
    await stopRecording();
  }, [stopRecording]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>SITUATION</Text>
        <Text style={styles.instruction}>{exercise.instruction_text}</Text>
        {exercise.situation_text != null && (
          <View style={styles.situationBox}>
            <Text style={styles.situationLabel}>상황</Text>
            <Text style={styles.situationText}>{exercise.situation_text}</Text>
          </View>
        )}
        <Text style={styles.hint}>
          이 상황에서 영어로 뭐라고 할지 말해보세요.
        </Text>
      </View>
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
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  label: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  instruction: {
    fontSize: font.size.md,
    color: colors.textSecondary,
    lineHeight: font.size.md * 1.5,
  },
  situationBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.xs,
  },
  situationLabel: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    letterSpacing: 1,
    color: "#3b82f6",
  },
  situationText: {
    fontSize: font.size.base,
    color: colors.text,
    lineHeight: font.size.base * 1.6,
  },
  hint: {
    fontSize: font.size.sm,
    color: colors.textMuted,
  },
});
