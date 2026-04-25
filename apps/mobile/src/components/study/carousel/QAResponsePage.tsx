// @MX:NOTE: [AUTO] QA response exercise page with recording (SPEC-MOBILE-011).
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { TransformationExercise } from "@inputenglish/shared";
import useAudioRecorder from "../../../hooks/useAudioRecorder";
import { ExerciseRecordingBar } from "./ExerciseRecordingBar";
import { colors, font, leading, radius, spacing } from "../../../theme";

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

  const [referenceRevealed, setReferenceRevealed] = useState(false);

  useEffect(() => {
    if (recordingState !== "playback") {
      setReferenceRevealed(false);
    }
  }, [recordingState]);

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
        nestedScrollEnabled
      >
        <Text style={styles.eyebrow}>Q&A RESPONSE</Text>
        <Text style={styles.instruction}>{exercise.instruction_text}</Text>
        {exercise.question_text != null && (
          <View style={styles.promptBox}>
            <Text style={styles.promptEyebrow}>Q</Text>
            <Text style={styles.promptText}>{exercise.question_text}</Text>
          </View>
        )}
        {recordingState === "playback" && exercise.reference_answer ? (
          <Pressable
            style={[
              styles.referenceBox,
              !referenceRevealed && styles.referenceBoxCollapsed,
            ]}
            onPress={() => setReferenceRevealed(true)}
            disabled={referenceRevealed}
          >
            <Text style={styles.referenceHint}>
              이렇게 말해볼 수 있을 거예요
            </Text>
            {referenceRevealed ? (
              <Text style={styles.referenceText}>
                {exercise.reference_answer}
              </Text>
            ) : (
              <Text style={styles.referenceTapCta}>눌러서 보기</Text>
            )}
          </Pressable>
        ) : null}
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
    gap: spacing.sm,
  },
  promptEyebrow: {
    fontSize: 9,
    fontWeight: font.weight.bold,
    letterSpacing: 1.5,
    color: colors.textMuted,
  },
  promptText: {
    fontSize: font.size.base,
    fontWeight: font.weight.semibold,
    color: colors.text,
    lineHeight: leading(font.size.base, font.lineHeight.relaxed),
    letterSpacing: font.tracking.semiTight,
  },
  referenceBox: {
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  referenceBoxCollapsed: {
    opacity: 0.72,
  },
  referenceHint: {
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
    letterSpacing: font.tracking.normal,
    color: colors.textMuted,
  },
  referenceTapCta: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    letterSpacing: font.tracking.normal,
    color: colors.textSecondary,
  },
  referenceText: {
    fontSize: font.size.base,
    fontWeight: font.weight.semibold,
    color: colors.text,
    lineHeight: leading(font.size.base, font.lineHeight.relaxed),
    letterSpacing: font.tracking.normal,
  },
});
