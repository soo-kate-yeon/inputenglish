// @MX:NOTE: [AUTO] KR->EN translation exercise page with recording (SPEC-MOBILE-011).
// Shows source_korean text; user records their English translation.
import React, { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TransformationExercise } from "@inputenglish/shared";
import useAudioRecorder from "../../../hooks/useAudioRecorder";
import { ExerciseRecordingBar } from "./ExerciseRecordingBar";
import { colors, font, spacing } from "../../../theme";

interface KoreanToEnglishPageProps {
  exercise: TransformationExercise;
  onConfirm: (audioUri: string | null, duration: number) => void;
}

export function KoreanToEnglishPage({
  exercise,
  onConfirm,
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

  const handleConfirm = useCallback(() => {
    onConfirm(audioUri, duration);
  }, [audioUri, duration, onConfirm]);

  const handleStop = useCallback(async () => {
    await stopRecording();
  }, [stopRecording]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>KR → EN</Text>
        <Text style={styles.instruction}>{exercise.instruction_text}</Text>
        {exercise.source_korean != null && (
          <View style={styles.koreanBox}>
            <Text style={styles.koreanText}>{exercise.source_korean}</Text>
          </View>
        )}
        <Text style={styles.hint}>녹음 버튼을 눌러 영어로 말해보세요.</Text>
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
  koreanBox: {
    backgroundColor: colors.bgMuted,
    borderRadius: 8,
    padding: spacing.md,
  },
  koreanText: {
    fontSize: font.size.base,
    fontWeight: font.weight.medium,
    color: colors.text,
    lineHeight: font.size.base * 1.6,
  },
  hint: {
    fontSize: font.size.sm,
    color: colors.textMuted,
  },
});
