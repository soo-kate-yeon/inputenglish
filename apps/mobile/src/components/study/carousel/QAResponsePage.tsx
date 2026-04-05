// @MX:NOTE: [AUTO] QA response exercise page with recording (SPEC-MOBILE-011).
// Shows question_text; user records their English answer.
import React, { useCallback, useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { TransformationExercise } from "@inputenglish/shared";
import useAudioRecorder from "../../../hooks/useAudioRecorder";
import { ExerciseRecordingBar } from "./ExerciseRecordingBar";
import { colors, font, radius, spacing } from "../../../theme";

interface QAResponsePageProps {
  exercise: TransformationExercise;
  onConfirm: (audioUri: string | null, duration: number) => void;
  onRecordingStateChange?: (recording: boolean) => void;
}

export function QAResponsePage({
  exercise,
  onConfirm,
  onRecordingStateChange,
}: QAResponsePageProps) {
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
        <Text style={styles.label}>Q&A RESPONSE</Text>
        <Text style={styles.instruction}>{exercise.instruction_text}</Text>
        {exercise.question_text != null && (
          <View style={styles.questionBox}>
            <Text style={styles.questionLabel}>Q</Text>
            <Text style={styles.questionText}>{exercise.question_text}</Text>
          </View>
        )}
        <Text style={styles.hint}>영어로 답변을 녹음해보세요.</Text>
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
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  label: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    letterSpacing: 2.5,
    color: colors.textSecondary,
  },
  instruction: {
    fontSize: font.size.md,
    color: colors.textSecondary,
    lineHeight: font.size.md * 1.6,
  },
  questionBox: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "flex-start",
  },
  questionLabel: {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: colors.textSecondary,
    minWidth: 20,
  },
  questionText: {
    flex: 1,
    fontSize: font.size.md,
    color: colors.text,
    lineHeight: font.size.md * 1.7,
  },
  hint: {
    fontSize: font.size.sm,
    color: colors.textMuted,
    fontStyle: "italic",
  },
});
