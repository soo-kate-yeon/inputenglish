// @MX:NOTE: [AUTO] QA response exercise page with recording (SPEC-MOBILE-011).
// Shows question_text; user records their English answer.
import React, { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TransformationExercise } from "@inputenglish/shared";
import useAudioRecorder from "../../../hooks/useAudioRecorder";
import { ExerciseRecordingBar } from "./ExerciseRecordingBar";
import { colors, font, spacing } from "../../../theme";

interface QAResponsePageProps {
  exercise: TransformationExercise;
  onConfirm: (audioUri: string | null, duration: number) => void;
}

export function QAResponsePage({ exercise, onConfirm }: QAResponsePageProps) {
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
        <Text style={styles.label}>Q&A RESPONSE</Text>
        <Text style={styles.instruction}>{exercise.instruction_text}</Text>
        {exercise.question_text != null && (
          <View style={styles.questionBox}>
            <Text style={styles.questionLabel}>Q</Text>
            <Text style={styles.questionText}>{exercise.question_text}</Text>
          </View>
        )}
        <Text style={styles.hint}>영어로 답변을 녹음해보세요.</Text>
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
  questionBox: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.bgMuted,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: "flex-start",
  },
  questionLabel: {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: colors.primary,
    minWidth: 20,
  },
  questionText: {
    flex: 1,
    fontSize: font.size.base,
    color: colors.text,
    lineHeight: font.size.base * 1.6,
  },
  hint: {
    fontSize: font.size.sm,
    color: colors.textMuted,
  },
});
