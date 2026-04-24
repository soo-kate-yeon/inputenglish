// @MX:NOTE: [AUTO] Dialog completion exercise page (SPEC-MOBILE-011).
import React, { useCallback, useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { TransformationExercise, DialogLine } from "@inputenglish/shared";
import useAudioRecorder from "../../../hooks/useAudioRecorder";
import { useTTS } from "../../../hooks/useTTS";
import { ExerciseRecordingBar } from "./ExerciseRecordingBar";
import { colors, font, leading, radius, spacing } from "../../../theme";

interface DialogCompletionPageProps {
  exercise: TransformationExercise;
  onConfirm: (audioUri: string | null, duration: number) => void;
  onRecordingStateChange?: (recording: boolean) => void;
}

interface DialogLineRowProps {
  line: DialogLine;
  index: number;
  isBlankRecorded: boolean;
  onSpeak: (text: string) => void;
  ttsAvailable: boolean;
}

function DialogLineRow({
  line,
  index,
  isBlankRecorded,
  onSpeak,
  ttsAvailable,
}: DialogLineRowProps) {
  const isUser = line.is_blank;

  return (
    <View style={[styles.lineContainer, isUser && styles.lineContainerUser]}>
      <Text style={styles.speaker}>{line.speaker}</Text>
      {isUser ? (
        <Text style={styles.blankHint}>
          {isBlankRecorded ? "✓ 녹음 완료" : "여기서 말해보세요 →"}
        </Text>
      ) : (
        <View style={styles.lineRow}>
          <Text style={styles.lineText}>{line.text}</Text>
          <Pressable
            testID={`tts-play-${index}`}
            style={({ pressed }) => [
              styles.ttsBtn,
              !ttsAvailable && styles.ttsBtnDisabled,
              pressed && ttsAvailable && { opacity: 0.6 },
            ]}
            onPress={() => ttsAvailable && onSpeak(line.text)}
            disabled={!ttsAvailable}
          >
            <Ionicons
              name="volume-medium"
              size={16}
              color={ttsAvailable ? colors.text : colors.textMuted}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function DialogCompletionPage({
  exercise,
  onConfirm,
  onRecordingStateChange,
}: DialogCompletionPageProps) {
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

  const { speak, isAvailable: ttsAvailable } = useTTS();

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

  const lines = exercise.dialog_lines ?? [];
  const isBlankRecorded = recordingState === "playback";

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>DIALOG COMPLETION</Text>
        <Text style={styles.instruction}>{exercise.instruction_text}</Text>
        <View style={styles.dialog}>
          {lines.map((line, i) => (
            <DialogLineRow
              key={i}
              line={line}
              index={i}
              isBlankRecorded={isBlankRecorded}
              onSpeak={speak}
              ttsAvailable={ttsAvailable}
            />
          ))}
        </View>
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
  dialog: {
    gap: spacing.sm,
  },
  lineContainer: {
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.xl,
  },
  lineContainerUser: {
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  speaker: {
    fontSize: 9,
    fontWeight: font.weight.bold,
    letterSpacing: 1.5,
    color: colors.textMuted,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  lineText: {
    flex: 1,
    fontSize: font.size.base,
    color: colors.text,
    lineHeight: leading(font.size.base, font.lineHeight.relaxed),
    letterSpacing: font.tracking.normal,
  },
  ttsBtn: {
    padding: 4,
    marginTop: 2,
  },
  ttsBtnDisabled: {
    opacity: 0.3,
  },
  blankHint: {
    fontSize: font.size.sm,
    color: colors.textMuted,
    letterSpacing: font.tracking.normal,
  },
});
