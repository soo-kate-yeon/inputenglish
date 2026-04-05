// @MX:NOTE: [AUTO] Situation-response exercise page (v2, SPEC-MOBILE-011).
// Shows a situation description; user records their spontaneous English response.
import React, { useCallback, useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { TransformationExercise } from "@inputenglish/shared";
import useAudioRecorder from "../../../hooks/useAudioRecorder";
import { ExerciseRecordingBar } from "./ExerciseRecordingBar";
import { colors, font, radius, spacing } from "../../../theme";

interface SituationResponsePageProps {
  exercise: TransformationExercise;
  onConfirm: (audioUri: string | null, duration: number) => void;
  onRecordingStateChange?: (recording: boolean) => void;
}

export function SituationResponsePage({
  exercise,
  onConfirm,
  onRecordingStateChange,
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
  situationBox: {
    backgroundColor: colors.bgMuted,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  situationLabel: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    letterSpacing: 1.5,
    color: colors.textSecondary,
  },
  situationText: {
    fontSize: font.size.base,
    color: colors.text,
    lineHeight: font.size.base * 1.7,
  },
  hint: {
    fontSize: font.size.sm,
    color: colors.textMuted,
    fontStyle: "italic",
  },
});
