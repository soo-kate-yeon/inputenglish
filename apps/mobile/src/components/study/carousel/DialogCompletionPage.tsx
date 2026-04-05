// @MX:NOTE: [AUTO] Dialog completion exercise page (SPEC-MOBILE-011).
// Non-blank lines have TTS play buttons (English only); blank turn shows recording bar.
import React, { useCallback } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { TransformationExercise, DialogLine } from "@inputenglish/shared";
import useAudioRecorder from "../../../hooks/useAudioRecorder";
import { useTTS } from "../../../hooks/useTTS";
import { ExerciseRecordingBar } from "./ExerciseRecordingBar";
import { colors, font, spacing, radius } from "../../../theme";

interface DialogCompletionPageProps {
  exercise: TransformationExercise;
  onConfirm: (audioUri: string | null, duration: number) => void;
}

interface DialogLineRowProps {
  line: DialogLine;
  index: number;
  onSpeak: (text: string) => void;
  ttsAvailable: boolean;
  // Recording props for blank turn
  recordingState: "idle" | "recording" | "playback";
  duration: number;
  isPlaying: boolean;
  playbackProgress: number;
  onStart: () => void;
  onStop: () => void;
  onPlay: () => void;
  onPause: () => void;
  onReRecord: () => void;
  onConfirm: () => void;
}

function DialogLineRow({
  line,
  index,
  onSpeak,
  ttsAvailable,
  recordingState,
  duration,
  isPlaying,
  playbackProgress,
  onStart,
  onStop,
  onPlay,
  onPause,
  onReRecord,
  onConfirm,
}: DialogLineRowProps) {
  const isUser = line.is_blank;

  return (
    <View style={[styles.lineContainer, isUser && styles.lineContainerUser]}>
      <Text style={styles.speaker}>{line.speaker}</Text>
      {isUser ? (
        // Blank turn: show recording bar inline
        <View style={styles.blankTurn}>
          <Text style={styles.blankHint}>여기서 말해보세요</Text>
          <ExerciseRecordingBar
            recordingState={recordingState}
            duration={duration}
            isPlaying={isPlaying}
            playbackProgress={playbackProgress}
            onStart={onStart}
            onStop={onStop}
            onPlay={onPlay}
            onPause={onPause}
            onReRecord={onReRecord}
            onConfirm={onConfirm}
          />
        </View>
      ) : (
        // Non-blank: show text + TTS button
        <View style={styles.lineRow}>
          <Text style={styles.lineText}>{line.text}</Text>
          <TouchableOpacity
            testID={`tts-play-${index}`}
            style={[styles.ttsBtn, !ttsAvailable && styles.ttsBtnDisabled]}
            onPress={() => ttsAvailable && onSpeak(line.text)}
            activeOpacity={ttsAvailable ? 0.7 : 1}
          >
            <Ionicons
              name="volume-medium"
              size={18}
              color={ttsAvailable ? colors.text : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export function DialogCompletionPage({
  exercise,
  onConfirm,
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

  const handleConfirm = useCallback(() => {
    onConfirm(audioUri, duration);
  }, [audioUri, duration, onConfirm]);

  const handleStop = useCallback(async () => {
    await stopRecording();
  }, [stopRecording]);

  const lines = exercise.dialog_lines ?? [];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>DIALOG COMPLETION</Text>
        <Text style={styles.instruction}>{exercise.instruction_text}</Text>
        <View style={styles.dialog}>
          {lines.map((line, i) => (
            <DialogLineRow
              key={i}
              line={line}
              index={i}
              onSpeak={speak}
              ttsAvailable={ttsAvailable}
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
          ))}
        </View>
      </ScrollView>
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
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
  dialog: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  lineContainer: {
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.md,
  },
  lineContainerUser: {
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  speaker: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    letterSpacing: 0.5,
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  lineText: {
    flex: 1,
    fontSize: font.size.md,
    color: colors.text,
    lineHeight: font.size.md * 1.6,
  },
  ttsBtn: {
    padding: 6,
    marginTop: 2,
  },
  ttsBtnDisabled: {
    opacity: 0.3,
  },
  blankTurn: {
    gap: spacing.sm,
  },
  blankHint: {
    fontSize: font.size.sm,
    color: colors.textMuted,
    fontStyle: "italic",
  },
});
